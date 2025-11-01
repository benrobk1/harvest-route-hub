import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface ValidationContext<T> {
  input: T;
}

/**
 * Validation Middleware
 * Validates request body against Zod schema
 * Returns 400 with validation errors if validation fails
 */
export function withValidation<TInput, TContext>(
  schema: z.ZodSchema<TInput>,
  handler: (req: Request, ctx: TContext & ValidationContext<TInput>) => Promise<Response>
) {
  return async (req: Request, ctx: TContext): Promise<Response> => {
    try {
      const body = await req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        return new Response(
          JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: result.error.flatten(),
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: 'Invalid JSON body',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  };
}
