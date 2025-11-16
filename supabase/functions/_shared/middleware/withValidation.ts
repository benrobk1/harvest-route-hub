import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface ValidationContext<T> {
  input: T;
}

/**
 * Validation Middleware Factory (Curried)
 * Validates request body against Zod schema
 * Returns 400 with validation errors if validation fails
 * 
 * @example
 * const handler = withValidation(mySchema)(async (req, ctx) => {
 *   console.log('Validated input:', ctx.input);
 *   return new Response('OK');
 * });
 */
export const withValidation = <TInput>(
  schema: z.ZodSchema<TInput>
) => {
  return <TContext extends { corsHeaders?: Record<string, string> }>(
    handler: (req: Request, ctx: TContext & ValidationContext<TInput>) => Promise<Response>
  ): ((req: Request, ctx: TContext) => Promise<Response>) => {
    return async (req: Request, ctx: TContext): Promise<Response> => {
      // Skip validation for OPTIONS preflight requests
      if (req.method === 'OPTIONS') {
        return handler(req, ctx as TContext & ValidationContext<TInput>);
      }
      
      try {
        const body = await req.json();
        const result = schema.safeParse(body);

        if (!result.success) {
          const headers = ctx.corsHeaders || corsHeaders;
          return new Response(
            JSON.stringify({
              error: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: result.error.flatten(),
            }),
            {
              status: 400,
              headers: { ...headers, 'Content-Type': 'application/json' }
            }
          );
        }

        // Attach validated input to context
        const validationContext = {
          ...ctx,
          input: result.data,
        } as TContext & ValidationContext<TInput>;

        return handler(req, validationContext);
      } catch (error) {
        console.error('JSON parsing error:', error);
        const headers = ctx.corsHeaders || corsHeaders;
        return new Response(
          JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: 'Invalid JSON body',
          }),
          {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          }
        );
      }
    };
  };
};
