import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

import { requireStripe } from "../_shared/config.ts";
import {
  createMiddlewareStack,
  withAdminAuth,
  withCORS,
  withErrorHandling,
  withRateLimit,
  withRequestId,
  withSupabaseServiceRole,
} from "../_shared/middleware/index.ts";
import type { AdminAuthContext } from "../_shared/middleware/withAdminAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

import { PayoutService } from "../_shared/services/PayoutService.ts";

interface ProcessPayoutsContext
  extends RequestIdContext,
    CORSContext,
    AdminAuthContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<ProcessPayoutsContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withRateLimit({
    maxRequests: 1,
    windowMs: 5 * 60 * 1000,
    keyPrefix: "process-payouts",
  }),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, user, config } = ctx;
  requireStripe(config);

  console.log(
    `[${requestId}] [PROCESS-PAYOUTS] Starting payout run`,
    { adminId: user.id },
  );

  const stripe = new Stripe(config.stripe.secretKey, {});
  const payoutService = new PayoutService(supabase, stripe);
  const result = await payoutService.processPendingPayouts();

  console.log(
    `[${requestId}] [PROCESS-PAYOUTS] Completed payout run`,
    {
      successful: result.successful,
      failed: result.failed,
      skipped: result.skipped,
    },
  );

  return new Response(
    JSON.stringify({
      success: true,
      payouts_processed: result.successful + result.failed,
      total_amount: result.totalAmount,
      failures:
        result.errors.length > 0
          ? result.errors.map((error) => ({
              payout_id: error.payoutId,
              error: error.error,
            }))
          : undefined,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

serve((req) => {
  const initialContext: Partial<ProcessPayoutsContext> = {};

  return handler(req, initialContext);
});
