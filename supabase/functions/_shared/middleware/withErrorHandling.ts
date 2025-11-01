const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Error Handling Middleware
 * Catches unhandled errors and returns structured error responses
 * Logs errors for debugging
 */
export function withErrorHandling<T>(
  handler: (req: Request, ctx: T) => Promise<Response>
) {
  return async (req: Request, ctx: T): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      console.error('Unhandled error in edge function:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Log stack trace for debugging
      if (errorStack) {
        console.error('Stack trace:', errorStack);
      }
      
      return new Response(
        JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: errorMessage,
          // Don't expose stack traces in production
          ...(Deno.env.get('ENVIRONMENT') === 'development' && { stack: errorStack }),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  };
}
