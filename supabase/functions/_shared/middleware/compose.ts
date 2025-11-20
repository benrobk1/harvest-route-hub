/**
 * MIDDLEWARE COMPOSITION UTILITY
 * Allows chaining multiple middleware functions together
 * Follows a bottom-up composition pattern where middlewares wrap each other
 */

type Middleware<T> = (
  handler: (req: Request, ctx: T) => Promise<Response>
) => (req: Request, ctx: T) => Promise<Response>;

/**
 * Composes multiple middleware functions into a single middleware chain
 * 
 * @param middlewares - Array of middleware functions to compose
 * @returns A single composed middleware function
 * 
 * @example
 * ```typescript
 * const composed = composeMiddleware([
 *   withErrorHandling,
 *   withCORS,
 *   withAuth,
 *   withValidation
 * ]);
 * 
 * Deno.serve(composed(async (req, ctx) => {
 *   // Your handler logic with all middleware applied
 *   return new Response(JSON.stringify({ data: 'Hello' }));
 * }));
 * ```
 */
export function composeMiddleware<T>(
  middlewares: Middleware<T>[]
): Middleware<T> {
  return (handler: (req: Request, ctx: T) => Promise<Response>) => {
    // Compose from right to left (reverse order)
    // The last middleware in the array runs first
    return middlewares.reduceRight(
      (composed, middleware) => middleware(composed),
      handler
    );
  };
}

/**
 * Creates a middleware stack with a specific execution order
 * This is a more explicit alternative to composeMiddleware
 * 
 * @param middlewares - Middleware functions in execution order (first runs first)
 * @returns A composed middleware function
 * 
 * @example
 * ```typescript
 * const stack = createMiddlewareStack([
 *   withErrorHandling,  // Runs first (wraps everything)
 *   withRequestId,      // Runs second
 *   withCORS,          // Runs third
 *   withAuth,          // Runs fourth (innermost)
 * ]);
 * ```
 */
export function createMiddlewareStack<T>(
  middlewares: Middleware<T>[]
): Middleware<T> {
  // Reverse the order so the first middleware wraps everything else
  return composeMiddleware([...middlewares].reverse());
}
