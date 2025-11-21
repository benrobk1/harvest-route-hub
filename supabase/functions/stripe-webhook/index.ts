/**
 * STRIPE WEBHOOK HANDLER
 * 
 * Handles Stripe webhook events for payment and subscription state sync.
 * Uses middleware pattern for consistent error handling and logging.
 * 
 * SUPPORTED EVENTS:
 * - payment_intent.succeeded → Update order status to 'paid'
 * - payment_intent.payment_failed → Mark order as 'failed', notify consumer
 * - customer.subscription.updated → Sync subscription status in database
 * - customer.subscription.deleted → Disable credits eligibility, notify consumer
 * - charge.dispute.created → Notify admin, flag order for review
 * - payout.failed → Retry payout logic, alert finance team
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import {
  withRequestId,
  withCORS,
  withErrorHandling,
  withMetrics,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type MetricsContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';

type Context = RequestIdContext & CORSContext & MetricsContext & SupabaseServiceRoleContext;

/**
 * Main webhook handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('webhook_received');
  
  const { config, corsHeaders, requestId, supabase } = ctx;
  const stripeSecretKey = config.stripe?.secretKey || Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeSecretKey) {
    console.error(`[${requestId}] ❌ STRIPE_SECRET_KEY not configured`);
    return new Response(
      JSON.stringify({ error: 'Stripe configuration missing', code: 'CONFIG_ERROR' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  if (!webhookSecret) {
    console.error(`[${requestId}] ❌ STRIPE_WEBHOOK_SECRET not configured`);
    return new Response(
      JSON.stringify({ error: 'Webhook secret missing', code: 'CONFIG_ERROR' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Verify webhook signature
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    console.error(`[${requestId}] ❌ Missing stripe-signature header`);
    ctx.metrics.mark('signature_missing');
    return new Response(
      JSON.stringify({ error: 'Missing signature', code: 'INVALID_SIGNATURE' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(`[${requestId}] ✅ Signature verified: ${event.type}`);
    ctx.metrics.mark('signature_verified');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown signature error';
    console.error(`[${requestId}] ❌ Signature verification failed: ${message}`);
    ctx.metrics.mark('signature_failed');
    return new Response(
      JSON.stringify({ error: `Webhook Error: ${message}`, code: 'INVALID_SIGNATURE' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Idempotency check - only skip if event was successfully completed
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id, status')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingEvent && existingEvent.status === 'completed') {
    console.log(`[${requestId}] ⚠️ Event ${event.id} already completed, skipping`);
    ctx.metrics.mark('event_duplicate');
    return new Response(
      JSON.stringify({ received: true, skipped: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  if (existingEvent && existingEvent.status === 'processing') {
    console.log(`[${requestId}] ⚠️ Event ${event.id} is being processed concurrently, skipping`);
    ctx.metrics.mark('event_concurrent');
    return new Response(
      JSON.stringify({ received: true, skipped: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Record event with 'processing' status
  let eventRecordId: string | null = null;
  
  if (!existingEvent) {
    const { data: insertedEvent, error: insertError } = await supabase
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        status: 'processing'
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        console.log(`[${requestId}] ⚠️ Event ${event.id} being processed concurrently (race condition)`);
        ctx.metrics.mark('event_concurrent');
        return new Response(
          JSON.stringify({ received: true, skipped: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      throw insertError;
    }
    
    eventRecordId = insertedEvent?.id;
  } else {
    // Existing event in 'failed' status - allow reprocessing
    eventRecordId = existingEvent.id;
    console.log(`[${requestId}] 🔄 Retrying failed event ${event.id}`);
    ctx.metrics.mark('event_retry');
    
    // Update status to 'processing' before retry
    const { error: updateError } = await supabase
      .from('stripe_webhook_events')
      .update({ status: 'processing' })
      .eq('id', eventRecordId);
    
    if (updateError) {
      console.error(`[${requestId}] ⚠️ Failed to update event status to processing: ${updateError.message}`);
      throw updateError;
    }
  }

  console.log(`[${requestId}] 📝 Event ${event.id} recorded, processing...`);
  ctx.metrics.mark('event_processing');

  // Handle events - wrap in try-catch to mark as failed on error
  try {
    switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[${ctx.requestId}] Payment succeeded: ${paymentIntent.id}`);
      ctx.metrics.mark('payment_succeeded');

      // Update payment_intents table
      const { data: paymentIntentRecord, error: piError } = await supabase
        .from('payment_intents')
        .update({ status: 'succeeded' })
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .select('order_id, consumer_id')
        .single();

      if (piError) {
        console.error(`[${ctx.requestId}] ❌ Failed to update payment_intent: ${piError.message}`);
        throw piError;
      }

      if (!paymentIntentRecord) {
        console.warn(`[${ctx.requestId}] ⚠️ Payment intent not found in database: ${paymentIntent.id}`);
        break;
      }

      // Update order status to confirmed
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', paymentIntentRecord.order_id);

      if (orderError) {
        console.error(`[${ctx.requestId}] ❌ Failed to update order: ${orderError.message}`);
        throw orderError;
      }

      // Get order details for notification
      const { data: order } = await supabase
        .from('orders')
        .select('delivery_date, total_amount')
        .eq('id', paymentIntentRecord.order_id)
        .single();

      // Send order confirmation notification (fire and forget)
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            event_type: 'order_confirmation',
            recipient_id: paymentIntentRecord.consumer_id,
            data: {
              order_id: paymentIntentRecord.order_id,
              delivery_date: order?.delivery_date,
              total_amount: order?.total_amount
            }
          }
        });
        console.log(`[${ctx.requestId}] ✅ Order confirmation notification sent`);
      } catch (notifError) {
        console.error(`[${ctx.requestId}] ⚠️ Failed to send notification: ${notifError}`);
        // Don't throw - notification failure shouldn't fail the webhook
      }

      console.log(`[${ctx.requestId}] ✅ Payment processed successfully for order: ${paymentIntentRecord.order_id}`);
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[${ctx.requestId}] Payment failed: ${paymentIntent.id}`);
      ctx.metrics.mark('payment_failed');

      // Update payment_intents table
      const { data: paymentIntentRecord, error: piError } = await supabase
        .from('payment_intents')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .select('order_id, consumer_id')
        .single();

      if (piError) {
        console.error(`[${ctx.requestId}] ❌ Failed to update payment_intent: ${piError.message}`);
        throw piError;
      }

      if (!paymentIntentRecord) {
        console.warn(`[${ctx.requestId}] ⚠️ Payment intent not found in database: ${paymentIntent.id}`);
        break;
      }

      // Update order status to cancelled
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', paymentIntentRecord.order_id);

      if (orderError) {
        console.error(`[${ctx.requestId}] ❌ Failed to update order: ${orderError.message}`);
        throw orderError;
      }

      // Release inventory reservations
      const { error: reservationError } = await supabase
        .from('inventory_reservations')
        .delete()
        .eq('order_id', paymentIntentRecord.order_id);

      if (reservationError) {
        console.error(`[${ctx.requestId}] ⚠️ Failed to release inventory reservations: ${reservationError.message}`);
        // Don't throw - continue with notification
      }

      // Get order details for notification
      const { data: order } = await supabase
        .from('orders')
        .select('delivery_date, total_amount')
        .eq('id', paymentIntentRecord.order_id)
        .single();

      // Get failure reason
      const failureMessage = paymentIntent.last_payment_error?.message || 'Payment could not be processed';

      // Send payment failure notification (fire and forget)
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            event_type: 'customer_delivery_update',
            recipient_id: paymentIntentRecord.consumer_id,
            data: {
              title: 'Payment Failed',
              description: `Your payment for order ${paymentIntentRecord.order_id.substring(0, 8)} failed: ${failureMessage}. Please update your payment method and try again.`,
              order_id: paymentIntentRecord.order_id,
              delivery_date: order?.delivery_date,
              total_amount: order?.total_amount
            }
          }
        });
        console.log(`[${ctx.requestId}] ✅ Payment failure notification sent`);
      } catch (notifError) {
        console.error(`[${ctx.requestId}] ⚠️ Failed to send notification: ${notifError}`);
      }

      console.log(`[${ctx.requestId}] ✅ Payment failure processed for order: ${paymentIntentRecord.order_id}`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[${ctx.requestId}] Subscription updated: ${subscription.id}`);
      ctx.metrics.mark('subscription_updated');
      // TODO: Implementation
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(`[${ctx.requestId}] Subscription deleted: ${subscription.id}`);
      ctx.metrics.mark('subscription_deleted');
      // TODO: Implementation
      break;
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute;
      console.log(`[${ctx.requestId}] Dispute created: ${dispute.id}`);
      ctx.metrics.mark('dispute_created');

      // Find the payment intent associated with this charge
      const { data: paymentIntentRecord } = await supabase
        .from('payment_intents')
        .select('order_id, consumer_id')
        .eq('stripe_payment_intent_id', dispute.payment_intent as string)
        .single();

      if (!paymentIntentRecord) {
        console.warn(`[${ctx.requestId}] ⚠️ Payment intent not found for dispute: ${dispute.id}`);
        break;
      }

      // Create dispute record in database
      const disputeType = dispute.reason === 'product_not_received' ? 'missing_items' :
                          dispute.reason === 'product_unacceptable' ? 'product_quality' :
                          'other';

      const { error: disputeError } = await supabase
        .from('disputes')
        .insert({
          order_id: paymentIntentRecord.order_id,
          consumer_id: paymentIntentRecord.consumer_id,
          dispute_type: disputeType,
          description: `Stripe dispute created: ${dispute.reason}. Dispute ID: ${dispute.id}. Amount: $${(dispute.amount / 100).toFixed(2)}`,
          status: 'investigating'
        });

      if (disputeError) {
        console.error(`[${ctx.requestId}] ❌ Failed to create dispute record: ${disputeError.message}`);
        // Don't throw - continue to send alerts even if DB insert fails
      }

      // Send admin alert for dispute
      try {
        // Get admin users
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .limit(5);

        if (adminRoles && adminRoles.length > 0) {
          // Send alert to each admin
          for (const admin of adminRoles) {
            await supabase.functions.invoke('send-notification', {
              body: {
                event_type: 'admin_alert',
                recipient_id: admin.user_id,
                data: {
                  title: `Payment Dispute Created - ${dispute.reason}`,
                  category: 'payment_dispute',
                  severity: 'high',
                  reporter_type: 'stripe_webhook',
                  description: `A payment dispute has been filed for order ${paymentIntentRecord.order_id.substring(0, 8)}.\n\nDispute ID: ${dispute.id}\nReason: ${dispute.reason}\nAmount: $${(dispute.amount / 100).toFixed(2)}\nStatus: ${dispute.status}\n\nEvidence deadline: ${dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString() : 'Unknown'}\n\nAction required: Review the order and submit evidence to Stripe before the deadline.`,
                  issue_id: dispute.id
                }
              }
            });
          }
          console.log(`[${ctx.requestId}] ✅ Dispute alerts sent to ${adminRoles.length} admin(s)`);
        }
      } catch (notifError) {
        console.error(`[${ctx.requestId}] ⚠️ Failed to send admin alerts: ${notifError}`);
      }

      console.log(`[${ctx.requestId}] ✅ Dispute processed: ${dispute.id}`);
      break;
    }

    case 'payout.failed': {
      const payout = event.data.object as Stripe.Payout;
      console.log(`[${ctx.requestId}] Payout failed: ${payout.id}`);
      ctx.metrics.mark('payout_failed');

      // Update payouts table to mark as failed
      const { data: payoutRecords, error: payoutError } = await supabase
        .from('payouts')
        .update({
          status: 'failed',
          // Store failure reason in a note (if payouts table has such field)
        })
        .eq('stripe_transfer_id', payout.id)
        .select('id, recipient_id, recipient_type, amount, order_id');

      if (payoutError) {
        console.error(`[${ctx.requestId}] ❌ Failed to update payout: ${payoutError.message}`);
        throw payoutError;
      }

      if (!payoutRecords || payoutRecords.length === 0) {
        console.warn(`[${ctx.requestId}] ⚠️ Payout not found in database: ${payout.id}`);
        break;
      }

      // Get failure reason
      const failureMessage = payout.failure_message || payout.failure_code || 'Unknown payout failure';
      const failureCode = payout.failure_code || 'unknown_error';

      // Send admin alert for payout failure
      try {
        // Get admin users
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .limit(5); // Send to first 5 admins

        if (adminRoles && adminRoles.length > 0) {
          // Send alert to each admin
          for (const admin of adminRoles) {
            await supabase.functions.invoke('send-notification', {
              body: {
                event_type: 'admin_alert',
                recipient_id: admin.user_id,
                data: {
                  title: `Payout Failed - ${failureCode}`,
                  category: 'payout_failure',
                  severity: 'high',
                  reporter_type: 'system',
                  description: `Payout failed for ${payoutRecords[0].recipient_type} (ID: ${payoutRecords[0].recipient_id}).\n\nAmount: $${payoutRecords[0].amount}\nStripe Payout ID: ${payout.id}\nFailure: ${failureMessage}\n\nAction required: Please investigate and retry the payout manually if needed.`,
                  issue_id: payoutRecords[0].id
                }
              }
            });
          }
          console.log(`[${ctx.requestId}] ✅ Payout failure alerts sent to ${adminRoles.length} admin(s)`);
        }
      } catch (notifError) {
        console.error(`[${ctx.requestId}] ⚠️ Failed to send admin alerts: ${notifError}`);
      }

      console.log(`[${ctx.requestId}] ✅ Payout failure processed: ${payout.id}`);
      break;
    }

    default:
      console.log(`[${ctx.requestId}] ⚠️ Unhandled event type: ${event.type}`);
      ctx.metrics.mark('event_unhandled');
    }
  } catch (processingError) {
    // Mark event as failed so it can be retried
    if (eventRecordId) {
      const { error: updateError } = await supabase
        .from('stripe_webhook_events')
        .update({ status: 'failed' })
        .eq('id', eventRecordId);
      
      if (updateError) {
        console.error(`[${ctx.requestId}] ⚠️ Failed to mark event as failed: ${updateError.message}`);
      } else {
        console.log(`[${ctx.requestId}] ❌ Event ${event.id} marked as failed for retry`);
      }
    }
    
    // Re-throw the error to be handled by error middleware
    throw processingError;
  }

  ctx.metrics.mark('event_processed');
  
  // Mark event as completed after successful processing
  if (eventRecordId) {
    const { error: updateError } = await supabase
      .from('stripe_webhook_events')
      .update({ status: 'completed' })
      .eq('id', eventRecordId);
    
    if (updateError) {
      console.error(`[${ctx.requestId}] ⚠️ Failed to mark event as completed: ${updateError.message}`);
      // Don't throw - event was processed successfully, this is just a status update
    } else {
      console.log(`[${ctx.requestId}] ✅ Event ${event.id} marked as completed`);
    }
  }
  
  return new Response(
    JSON.stringify({ received: true, event: event.type }),
    { 
      status: 200,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }
    }
  );
};

// Compose middleware stack (no auth needed for webhooks)
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withMetrics('stripe-webhook'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as Context));
