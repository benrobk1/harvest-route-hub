import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { RATE_LIMITS } from '../_shared/constants.ts';
import { OptimizeBatchesRequestSchema } from '../_shared/contracts/optimization.ts';
import { BatchOptimizationService } from '../_shared/services/BatchOptimizationService.ts';
import {
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withValidation,
  withRateLimit,
  withErrorHandling,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type SupabaseServiceRoleContext,
  type ValidationContext
} from '../_shared/middleware/index.ts';

/**
 * OPTIMIZE DELIVERY BATCHES EDGE FUNCTION
 * 
 * AI-powered batch optimization with geographic fallback.
 * Uses BatchOptimizationService for dual-path optimization.
 * Full middleware: RequestId + CORS + AdminAuth + RateLimit + Validation + ErrorHandling
 */

type OptimizeBatchesInput = { delivery_date: string };
type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  SupabaseServiceRoleContext &
  ValidationContext<OptimizeBatchesInput>;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { supabase } = ctx;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  const { delivery_date } = ctx.input;

  if (!lovableApiKey) {
    console.warn(`[${ctx.requestId}] ⚠️  LOVABLE_API_KEY not configured - will use fallback batching`);
  }

  console.log(`[${ctx.requestId}] Optimizing batches for delivery date: ${delivery_date}`);

  // Initialize optimization service
  const service = new BatchOptimizationService(supabase, lovableApiKey);
  const result = await service.optimizeBatches(delivery_date);

  console.log(`[${ctx.requestId}] ✅ Created ${result.batches_created} batches for ${result.total_orders} orders`);
  console.log(`[${ctx.requestId}] Optimization method: ${result.optimization_method}`);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withRateLimit(RATE_LIMITS.OPTIMIZE_BATCHES),
  withValidation(OptimizeBatchesRequestSchema),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
