/**
 * METRICS MIDDLEWARE
 * 
 * Tracks performance metrics for all edge function requests.
 * Automatically logs request/response metrics and errors.
 */

import { createMetricsCollector, MetricsCollector } from '../monitoring/metrics.ts';

export interface MetricsContext {
  requestId: string;
  metrics: MetricsCollector;
}

/**
 * Metrics Middleware (Curried)
 * Tracks performance and logs metrics automatically
 * 
 * @example
 * const handler = withMetrics('checkout')(async (req, ctx) => {
 *   ctx.metrics.mark('validation_complete');
 *   return new Response('OK');
 * });
 */
export const withMetrics = (functionName: string) => {
  return <T extends MetricsContext>(
    handler: (req: Request, ctx: T) => Promise<Response>
  ): ((req: Request, ctx: T) => Promise<Response>) => {
    return async (req: Request, ctx: T): Promise<Response> => {
      const url = new URL(req.url);
      const metrics = createMetricsCollector(ctx.requestId, functionName);

      const metricsContext = {
        ...ctx,
        metrics,
      } as T;

      try {
        const response = await handler(req, metricsContext);

        // Log successful request metrics
        metrics.log({
          method: req.method,
          path: url.pathname,
          statusCode: response.status,
          userId: (ctx as any).user?.id,
        });

        return response;
      } catch (error: any) {
        // Log error metrics
        metrics.log({
          method: req.method,
          path: url.pathname,
          statusCode: 500,
          userId: (ctx as any).user?.id,
          errorMessage: error.message,
          errorStack: error.stack,
        });

        throw error;
      }
    };
  };
};
