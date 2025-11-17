import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

import { requireStripe } from "../_shared/config.ts";
import { RATE_LIMITS } from "../_shared/constants.ts";
import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withMetrics,
  withRateLimit,
  withRequestId,
  withSupabaseServiceRole,
} from "../_shared/middleware/index.ts";
import type { AuthContext } from "../_shared/middleware/withAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { MetricsContext } from "../_shared/middleware/withMetrics.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

interface CheckSubscriptionContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    MetricsContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CheckSubscriptionContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withRateLimit(RATE_LIMITS.CHECK_SUBSCRIPTION),
  withMetrics('check-subscription'),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, user, metrics, config } = ctx;
  requireStripe(config);

  metrics.mark('subscription_check_started');

  if (!user.email) {
    throw new Error('Authenticated user must include an email address');
  }

  console.log(`[${requestId}] Checking subscription for user: ${user.id}`);

  const { data: localSub, error: localSubError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('consumer_id', user.id)
    .maybeSingle();

  if (localSubError) {
    throw localSubError;
  }

  metrics.mark('local_data_fetched');

  const stripe = new Stripe(config.stripe.secretKey, {});

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });

  if (customers.data.length === 0) {
    console.log(`[${requestId}] ℹ️ No Stripe customer for ${user.email}`);
    metrics.mark('no_stripe_customer');
    return new Response(JSON.stringify({
      subscribed: false,
      monthly_spend: localSub?.monthly_spend ?? 0,
      credits_available: 0,
      progress_to_credit: 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const customerId = customers.data[0].id;
  metrics.mark('stripe_customer_found');

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  });

  const validSubscription = subscriptions.data.find(
    (sub) => sub.status === 'active' || sub.status === 'trialing',
  );
  const hasActiveSub = validSubscription !== undefined;
  let subscriptionEnd: string | null = null;
  let trialEnd: string | null = null;
  let isTrialing = false;

  if (hasActiveSub && validSubscription) {
    const subscription = validSubscription;

    subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    isTrialing = subscription.status === 'trialing';

    if (subscription.trial_end) {
      trialEnd = new Date(subscription.trial_end * 1000).toISOString();
    }

    metrics.mark('active_subscription_found');

    const upsertResult = await supabase
      .from('subscriptions')
      .upsert({
        consumer_id: user.id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: isTrialing ? 'trialing' : 'active',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: subscriptionEnd,
        trial_end: trialEnd,
        monthly_spend: localSub?.monthly_spend ?? 0,
        credits_earned: localSub?.credits_earned ?? 0,
      }, { onConflict: 'consumer_id' });

    if (upsertResult.error) {
      console.error(`[${requestId}] [CHECK-SUBSCRIPTION] Error syncing subscription:`, upsertResult.error);
      throw upsertResult.error;
    }

    metrics.mark('subscription_synced');
  }

  const { data: availableCredits, error: creditsError } = await supabase
    .from('credits_ledger')
    .select('balance_after')
    .eq('consumer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (creditsError) {
    console.error(`[${requestId}] [CHECK-SUBSCRIPTION] Error fetching credits:`, creditsError);
    throw creditsError;
  }

  const creditsAvailable = availableCredits?.[0]?.balance_after ?? 0;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlySpend = localSub?.monthly_spend_period === currentMonth ? (localSub?.monthly_spend ?? 0) : 0;
  const progressToCredit = Math.min((monthlySpend / 100) * 100, 100);

  console.log(`[${requestId}] ✅ Subscription check complete`, {
    hasActiveSub,
    isTrialing,
    creditsAvailable,
  });

  metrics.mark('check_complete');

  return new Response(JSON.stringify({
    subscribed: hasActiveSub,
    subscription_end: subscriptionEnd,
    is_trialing: isTrialing,
    trial_end: trialEnd,
    monthly_spend: monthlySpend,
    credits_available: creditsAvailable,
    progress_to_credit: progressToCredit,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});

serve((req) => {
  const initialContext: Partial<CheckSubscriptionContext> = {};

  return handler(req, initialContext);
});
