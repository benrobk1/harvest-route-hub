import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { AuthContext } from "../_shared/middleware/withAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const CreateSubscriptionCheckoutSchema = z.object({
  enable_trial: z.boolean().optional().default(false),
});

type CreateSubscriptionCheckoutInput = z.infer<typeof CreateSubscriptionCheckoutSchema>;

interface CreateSubscriptionCheckoutContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    ValidationContext<CreateSubscriptionCheckoutInput>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CreateSubscriptionCheckoutContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withValidation(CreateSubscriptionCheckoutSchema),
]);

const handler = stack(async (req, ctx) => {
  const { corsHeaders, requestId, user, config, input } = ctx;

  if (!user.email) {
    throw new Error("Authenticated user must include an email address");
  }

  console.log(
    `[${requestId}] [CREATE-SUBSCRIPTION-CHECKOUT] Starting session creation`,
    { userId: user.id, enableTrial: input.enable_trial },
  );

  const stripe = new Stripe(config.stripe.secretKey, {});
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  const customerId = customers.data[0]?.id;

  const origin =
    req.headers.get("origin") ??
    corsHeaders["Access-Control-Allow-Origin"] ??
    "https://lovable.app";

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    line_items: [
      {
        price: "price_1SMh7wDipsIpa8WwwtVag1ej",
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${origin}/consumer/shop?subscription=success`,
    cancel_url: `${origin}/consumer/shop?subscription=cancelled`,
  };

  if (input.enable_trial) {
    sessionConfig.subscription_data = {
      trial_period_days: 60,
    };

    console.log(
      `[${requestId}] [CREATE-SUBSCRIPTION-CHECKOUT] Trial enabled`,
      { trialDays: 60 },
    );
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  console.log(
    `[${requestId}] [CREATE-SUBSCRIPTION-CHECKOUT] Session created`,
    { sessionId: session.id },
  );

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

serve((req) => {
  const initialContext: Partial<CreateSubscriptionCheckoutContext> = {};

  return handler(req, initialContext);
});
