const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Error Handling Middleware (Curried)
 * Catches unhandled errors and returns structured error responses
 * Logs errors for debugging and captures to Sentry if configured
 * 
 * @example
 * const handler = withErrorHandling(async (req, ctx) => {
 *   throw new Error('Test error');
 * });
 */
export const withErrorHandling = <T extends { requestId?: string; corsHeaders?: Record<string, string> }>(
  handler: (req: Request, ctx: T) => Promise<Response>
): ((req: Request, ctx: T) => Promise<Response>) => {
  return async (req: Request, ctx: T): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const requestId = ctx.requestId || 'unknown';
      console.error(`[${requestId}] Unhandled error in edge function:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Log stack trace for debugging
      if (errorStack) {
        console.error(`[${requestId}] Stack trace:`, errorStack);
      }
      
      // Capture to Sentry if configured (disabled by default)
      if (Deno.env.get('SENTRY_DSN')) {
        // TODO: Integrate Sentry Deno SDK
        // Sentry.captureException(error, { tags: { requestId } });
        console.log(`[${requestId}] Error would be captured to Sentry (SENTRY_DSN configured)`);
      }
      
      const headers = ctx.corsHeaders || corsHeaders;
      
      return new Response(
        JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: errorMessage,
          // Don't expose stack traces in production
          ...(Deno.env.get('ENVIRONMENT') === 'development' && { stack: errorStack }),
        }),
        {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' }
        }
      );
    }
  };
};
