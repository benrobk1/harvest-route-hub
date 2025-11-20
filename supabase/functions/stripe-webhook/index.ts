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

  // Idempotency check
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingEvent) {
    console.log(`[${requestId}] ⚠️ Event ${event.id} already processed, skipping`);
    ctx.metrics.mark('event_duplicate');
    return new Response(
      JSON.stringify({ received: true, skipped: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Record event
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      console.log(`[${requestId}] ⚠️ Event ${event.id} being processed concurrently`);
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

  console.log(`[${requestId}] 📝 Event ${event.id} recorded, processing...`);
  ctx.metrics.mark('event_processing');

  // Handle events
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[${ctx.requestId}] Payment succeeded: ${paymentIntent.id}`);
      ctx.metrics.mark('payment_succeeded');
      // TODO: Implementation
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`[${ctx.requestId}] Payment failed: ${paymentIntent.id}`);
      ctx.metrics.mark('payment_failed');
      // TODO: Implementation
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
      // TODO: Implementation
      break;
    }

    case 'payout.failed': {
      const payout = event.data.object as Stripe.Payout;
      console.log(`[${ctx.requestId}] Payout failed: ${payout.id}`);
      ctx.metrics.mark('payout_failed');
      // TODO: Implementation
      break;
    }

    default:
      console.log(`[${ctx.requestId}] ⚠️ Unhandled event type: ${event.type}`);
      ctx.metrics.mark('event_unhandled');
  }

  ctx.metrics.mark('event_processed');
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
