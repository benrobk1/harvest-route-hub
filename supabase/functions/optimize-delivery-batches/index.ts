/**
 * BATCH OPTIMIZATION EDGE FUNCTION (REFACTORED)
 * 
 * Thin handler that delegates to BatchOptimizationService.
 * Uses dual-path optimization: AI-powered (primary) + geographic (fallback).
 * 
 * WHY THIS MATTERS FOR YC DEMO:
 * - Handler is now ~50 lines (was 433) - easy to scan and review
 * - Business logic extracted to service layer for testability
 * - Still maintains all functionality with improved architecture
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { BatchOptimizationService } from '../_shared/services/BatchOptimizationService.ts';
import {
  createMiddlewareStack,
  withAdminAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from '../_shared/middleware/index.ts';
import type { AdminAuthContext } from '../_shared/middleware/withAdminAuth.ts';
import type { CORSContext } from '../_shared/middleware/withCORS.ts';
import type { RequestIdContext } from '../_shared/middleware/withRequestId.ts';
import type { SupabaseServiceRoleContext } from '../_shared/middleware/withSupabaseServiceRole.ts';

// Input validation schema
const OptimizeBatchesSchema = z.object({
  delivery_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" })
    .refine(date => !isNaN(Date.parse(date)), { message: "Invalid date value" })
});

type OptimizeInput = z.infer<typeof OptimizeBatchesSchema>;

interface OptimizeContext
  extends RequestIdContext,
    CORSContext,
    AdminAuthContext,
    SupabaseServiceRoleContext {
  input: OptimizeInput;
}

const stack = createMiddlewareStack<OptimizeContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withValidation(OptimizeBatchesSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, user, corsHeaders, requestId, config, input } = ctx;

  const lovableApiKey = config.lovable?.apiKey;

  if (!lovableApiKey) {
    console.warn(`[${requestId}] [BATCH_OPT] ⚠️  LOVABLE_API_KEY not configured - using geographic fallback`);
  }

  console.log(`[${requestId}] [BATCH_OPT] Admin user ${user.id} authorized for ${input.delivery_date}`);

  const service = new BatchOptimizationService(supabase, lovableApiKey);
  const result = await service.optimizeBatches(input.delivery_date);

  console.log(`[${requestId}] [BATCH_OPT] ✅ Created ${result.batches_created} batches for ${result.total_orders} orders`);

  return new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
});

serve((req) => {
  const initialContext: Partial<OptimizeContext> = {};

  return handler(req, initialContext);
});
