<<<<<<< HEAD
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
} from "../_shared/middleware/index.ts";
import type { AuthContext } from "../_shared/middleware/withAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

interface CancelOrderContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CancelOrderContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
]);

const handler = stack(async (req, ctx) => {
  const { user, supabase, corsHeaders, requestId } = ctx;

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const orderId = body.orderId;

  if (!orderId) {
    return new Response(
      JSON.stringify({ error: 'Order ID is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[${requestId}] [CANCEL-ORDER] User ${user.id} requested cancel for order ${orderId}`);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, consumer_id, status, total_amount, delivery_date')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.error(`[${requestId}] [CANCEL-ORDER] Order not found:`, orderError);
    return new Response(
      JSON.stringify({ error: 'Order not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (order.consumer_id !== user.id) {
    console.warn(`[${requestId}] [CANCEL-ORDER] User ${user.id} attempted to cancel another user's order`);
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const allowedStatuses = ['pending', 'paid', 'confirmed'];
  if (!allowedStatuses.includes(order.status)) {
    return new Response(
      JSON.stringify({
        error: `Cannot cancel order with status: ${order.status}. Only pending, paid, or confirmed orders can be cancelled.`
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const deliveryTime = new Date(order.delivery_date).getTime();
  const now = Date.now();
  const hoursUntilDelivery = (deliveryTime - now) / (1000 * 60 * 60);

  if (hoursUntilDelivery <= 24) {
    return new Response(
      JSON.stringify({
        error: 'Cannot cancel orders within 24 hours of delivery date'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  if (orderItems && orderItems.length > 0) {
    for (const item of orderItems) {
      const { data: product } = await supabase
        .from('products')
        .select('available_quantity')
        .eq('id', item.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({
            available_quantity: product.available_quantity + item.quantity
          })
          .eq('id', item.product_id);
      }
    }
  }

  await supabase
    .from('credits_ledger')
    .delete()
    .eq('order_id', orderId);

  await supabase
    .from('payment_intents')
    .delete()
    .eq('order_id', orderId);

  await supabase
    .from('transaction_fees')
    .delete()
    .eq('order_id', orderId);

  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (deleteError) {
    console.error(`[${requestId}] [CANCEL-ORDER] Error deleting order:`, deleteError);
    return new Response(
      JSON.stringify({ error: 'Failed to delete order' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log(`[${requestId}] [CANCEL-ORDER] Order ${orderId} permanently deleted`);

  return new Response(
    JSON.stringify({ success: true, message: 'Order cancelled and deleted successfully' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});

serve((req) => {
  const initialContext: Partial<CancelOrderContext> = {};

  return handler(req, initialContext);
});
=======
/**
 * CANCEL ORDER EDGE FUNCTION
 * Cancels orders with inventory restoration and cleanup
 * 
 * Full Middleware Pattern:
 * RequestId + CORS + Auth + RateLimit + Validation + ErrorHandling
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { CancelOrderRequestSchema } from '../_shared/contracts/index.ts';
import { OrderCancellationService } from '../_shared/services/OrderCancellationService.ts';
import { 
  withRequestId, 
  withCORS, 
  withAuth,
  withValidation,
  withRateLimit,
  withErrorHandling, 
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext
} from '../_shared/middleware/index.ts';

type CancelOrderInput = { orderId: string };
type Context = RequestIdContext & CORSContext & AuthContext & ValidationContext<CancelOrderInput>;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const config = loadConfig();
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
  const user = ctx.user;
  const { orderId } = ctx.input;

  // Business logic
  console.log(`[${ctx.requestId}] Cancelling order ${orderId} for user ${user.id}`);
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
        { status: 404, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (errorMessage.includes('INVALID_STATUS')) {
      return new Response(
        JSON.stringify({
          error: 'INVALID_STATUS',
          message: errorMessage.split(': ')[1] || 'Cannot cancel order with current status',
        }),
        { status: 400, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (errorMessage.includes('TOO_LATE_TO_CANCEL')) {
      return new Response(
        JSON.stringify({
          error: 'TOO_LATE_TO_CANCEL',
          message: 'Cannot cancel orders within 24 hours of delivery',
        }),
        { status: 400, headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw error;
  }

  console.log(`[${ctx.requestId}] ✅ Order ${orderId} cancelled successfully`);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Order cancelled and deleted successfully',
    }),
    {
      status: 200,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
    }
  );
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.CANCEL_ORDER),
  withValidation(CancelOrderRequestSchema),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
>>>>>>> main
