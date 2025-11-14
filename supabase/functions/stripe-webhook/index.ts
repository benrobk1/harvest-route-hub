import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

import {
  createMiddlewareStack,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
} from "../_shared/middleware/index.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

interface StripeWebhookContext
  extends RequestIdContext,
    CORSContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<StripeWebhookContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
]);

const handler = stack(async (req, ctx) => {
  const { corsHeaders, requestId, supabase, config } = ctx;

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!webhookSecret) {
    console.error(
      `[${requestId}] [STRIPE-WEBHOOK] STRIPE_WEBHOOK_SECRET not configured`,
    );
    return new Response("Webhook secret not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error(
      `[${requestId}] [STRIPE-WEBHOOK] Missing stripe-signature header`,
    );
    return new Response("Missing signature", {
      status: 400,
      headers: corsHeaders,
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log(
      `[${requestId}] [STRIPE-WEBHOOK] Signature verified`,
      { type: event.type },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[${requestId}] [STRIPE-WEBHOOK] Signature verification failed`,
      message,
    );
    return new Response(`Webhook Error: ${message}`, {
      status: 400,
      headers: corsHeaders,
    });
  }

  const { data: existingEvent } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingEvent) {
    console.log(
      `[${requestId}] [STRIPE-WEBHOOK] Event already processed`,
      { eventId: event.id },
    );

    return new Response(
      JSON.stringify({ received: true, skipped: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { error: insertError } = await supabase
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Concurrent event detected`,
        { eventId: event.id },
      );

      return new Response(
        JSON.stringify({ received: true, skipped: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.error(
      `[${requestId}] [STRIPE-WEBHOOK] Failed to record event`,
      insertError,
    );
    throw insertError;
  }

  console.log(
    `[${requestId}] [STRIPE-WEBHOOK] Processing event`,
    { eventId: event.id, type: event.type },
  );

  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Payment succeeded`,
        { paymentIntent: paymentIntent.id },
      );
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Payment failed`,
        { paymentIntent: paymentIntent.id },
      );
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Subscription updated`,
        { subscription: subscription.id },
      );
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Subscription deleted`,
        { subscription: subscription.id },
      );
      break;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Dispute created`,
        { dispute: dispute.id },
      );
      break;
    }
    case "payout.failed": {
      const payout = event.data.object as Stripe.Payout;
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Payout failed`,
        { payout: payout.id },
      );
      break;
    }
    default:
      console.log(
        `[${requestId}] [STRIPE-WEBHOOK] Unhandled event type`,
        { type: event.type },
      );
  }

  return new Response(
    JSON.stringify({ received: true, event: event.type }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

serve((req) => {
  const initialContext: Partial<StripeWebhookContext> = {};

  return handler(req, initialContext);
});
