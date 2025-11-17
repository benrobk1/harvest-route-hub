import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withValidation,
  withRateLimit,
  withErrorHandling,
  withMetrics,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type MetricsContext,
  type ValidationContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';

/**
 * CREATE SUBSCRIPTION CHECKOUT EDGE FUNCTION
 * 
 * Creates Stripe checkout session for subscription with optional trial.
 * Uses middleware pattern with full authentication and validation.
 */

// Validation schema
const CreateSubscriptionCheckoutSchema = z.object({
  enable_trial: z.boolean().optional().default(false),
});

type CreateSubscriptionCheckoutRequest = z.infer<typeof CreateSubscriptionCheckoutSchema>;

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  MetricsContext &
  ValidationContext<CreateSubscriptionCheckoutRequest> &
  SupabaseServiceRoleContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('checkout_creation_started');
  
  const { config, user } = ctx;
  
  if (!user.email) {
    throw new Error('User email not available');
  }

  console.log(`[${ctx.requestId}] Creating subscription checkout for user ${user.id}`);

  const stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2023-10-16',
  });

  // Check for existing customer
  const customers = await stripe.customers.list({
    email: user.email,
    limit: 1,
  });

  const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;
  console.log(`[${ctx.requestId}] Stripe customer: ${customerId || 'new'}`);
  
  ctx.metrics.mark(customerId ? 'existing_customer' : 'new_customer');

  // Create checkout session config
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    customer_email: customerId ? undefined : user.email,
    line_items: [
      {
        price: 'price_1SMh7wDipsIpa8WwwtVag1ej',
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${req.headers.get('origin')}/consumer/shop?subscription=success`,
    cancel_url: `${req.headers.get('origin')}/consumer/shop?subscription=cancelled`,
  };

  // Add trial if requested
  if (ctx.input.enable_trial) {
    sessionConfig.subscription_data = {
      trial_period_days: 60, // 2 months
    };
    console.log(`[${ctx.requestId}] Trial enabled: 60 days`);
    ctx.metrics.mark('trial_enabled');
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  console.log(`[${ctx.requestId}] ✅ Checkout session created: ${session.id}`);
  ctx.metrics.mark('session_created');

  return new Response(
    JSON.stringify({ url: session.url }),
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
  withValidation(CreateSubscriptionCheckoutSchema),
  withRateLimit(RATE_LIMITS.CREATE_SUBSCRIPTION),
  withSupabaseServiceRole,
  withMetrics('create-subscription-checkout'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
