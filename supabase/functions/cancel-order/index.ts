import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

import { CancelOrderRequestSchema } from '../_shared/contracts/index.ts';
import { OrderCancellationService } from '../_shared/services/OrderCancellationService.ts';
import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withRateLimit,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from '../_shared/middleware/index.ts';
import type { AuthContext } from '../_shared/middleware/withAuth.ts';
import type { CORSContext } from '../_shared/middleware/withCORS.ts';
import type { RequestIdContext } from '../_shared/middleware/withRequestId.ts';
import type { SupabaseServiceRoleContext } from '../_shared/middleware/withSupabaseServiceRole.ts';
import type { ValidationContext } from '../_shared/middleware/withValidation.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';

interface CancelOrderInput {
  orderId: string;
}

interface CancelOrderContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    ValidationContext<CancelOrderInput>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CancelOrderContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withRateLimit(RATE_LIMITS.CANCEL_ORDER),
  withValidation(CancelOrderRequestSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, user, corsHeaders, requestId, input } = ctx;
  const { orderId } = input;

  console.log(`[${requestId}] Cancelling order ${orderId} for user ${user.id}`);
  const cancellationService = new OrderCancellationService(supabase);

  try {
    await cancellationService.cancelOrder(orderId, user.id);
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';

    if (errorMessage.includes('ORDER_NOT_FOUND')) {
      return new Response(
        JSON.stringify({
          error: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (errorMessage.includes('INVALID_STATUS')) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_STATUS',
          message: errorMessage.split(': ')[1] || 'Cannot cancel order with current status',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (errorMessage.includes('TOO_LATE_TO_CANCEL')) {
      return new Response(
        JSON.stringify({
          error: 'TOO_LATE_TO_CANCEL',
          message: 'Cannot cancel orders within 24 hours of delivery',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    throw error;
  }

  console.log(`[${requestId}] ✅ Order ${orderId} cancelled successfully`);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Order cancelled and deleted successfully',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});

serve((req) => {
  const initialContext: Partial<CancelOrderContext> = {};

  return handler(req, initialContext);
});
