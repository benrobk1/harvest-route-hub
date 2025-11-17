/**
 * PROCESS PAYOUTS EDGE FUNCTION
 * Admin-only function to process pending farmer payouts via Stripe
 * 
 * Full Middleware Pattern:
 * RequestId + CORS + Auth + AdminAuth + RateLimit + ErrorHandling
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { RATE_LIMITS } from '../_shared/constants.ts';
import { PayoutService } from '../_shared/services/PayoutService.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withSupabaseServiceRole,
  withAdminAuth,
  withRateLimit,
  withErrorHandling,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type SupabaseServiceRoleContext,
} from '../_shared/middleware/index.ts';

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  SupabaseServiceRoleContext;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, config, supabase } = ctx;

  console.log(`[${requestId}] Processing pending payouts`);

  const stripe = new Stripe(config.stripe.secretKey);
  const payoutService = new PayoutService(supabase, stripe);
  const result = await payoutService.processPendingPayouts();

  console.log(`[${requestId}] ✅ Payouts complete: ${result.successful} successful, ${result.failed} failed`);

  return new Response(
    JSON.stringify({
      success: true,
      payouts_processed: result.successful + result.failed,
      total_amount: 0,
      failures: result.errors.length > 0 ? result.errors.map(e => ({
        payout_id: e.payoutId,
        error: e.error
      })) : undefined
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withAdminAuth,
  withRateLimit(RATE_LIMITS.PROCESS_PAYOUTS),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
