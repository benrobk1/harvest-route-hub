/**
 * CHECK SUBSCRIPTION EDGE FUNCTION
 * 
 * Purpose:
 * - Verifies if an authenticated user has an active Stripe subscription
 * - Synchronizes subscription data between Stripe and local database
 * - Calculates available credits and progress toward earning new credits
 * - Tracks trial period status and monthly spending
 * 
 * Business Model:
 * - Subscription Cost: $9.99/month (SUBSCRIPTION.MONTHLY_PRICE_USD from constants)
 * - Credit Rewards: Earn $10 credit for every $100 spent (CREDITS.EARNINGS_THRESHOLD)
 * - Credit Value: Each credit worth $10 (CREDITS.VALUE_PER_CREDIT)
 * - Credit Expiration: Credits expire after 30 days (CREDITS.EXPIRATION_DAYS)
 * - Trial Period: Supports Stripe trial subscriptions (default 60 days)
 * 
 * Authentication:
 * - Requires valid JWT token in Authorization header
 * - Token validated using Supabase Auth (anon key client)
 * - Database operations use service role key to bypass RLS
 * 
 * Called By:
 * - Frontend on user login
 * - Frontend on initial page load
 * - Frontend periodic refresh (every minute)
 * - After checkout completion to sync subscription status
 * 
 * Returns:
 * - subscribed: boolean - Whether user has active subscription
 * - subscription_end: ISO date - When current period ends
 * - is_trialing: boolean - Whether subscription is in trial period
 * - trial_end: ISO date - When trial ends (if applicable)
 * - monthly_spend: number - Current month's spending in USD
 * - credits_available: number - Available credit balance
 * - progress_to_credit: number - Percentage progress (0-100) toward next $10 credit
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { requireStripe } from "../_shared/config.ts";
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

interface CheckSubscriptionContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CheckSubscriptionContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, user, config } = ctx;
  requireStripe(config);

  if (!user.email) {
    throw new Error('Authenticated user must include an email address');
  }

  const stripe = new Stripe(config.stripe.secretKey, {});

  const logStep = (step: string, details?: unknown) => {
    const suffix = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`[${requestId}] [CHECK-SUBSCRIPTION] ${step}${suffix}`);
  };

  logStep('Function started', { userId: user.id });

  const { data: localSub, error: localSubError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('consumer_id', user.id)
    .maybeSingle();

  if (localSubError) {
    console.error(`[${requestId}] [CHECK-SUBSCRIPTION] Error loading local subscription:`, localSubError);
    throw localSubError;
  }

  logStep('Local subscription fetched');

  const customers = await stripe.customers.list({ email: user.email, limit: 1 });

  if (customers.data.length === 0) {
    logStep('No Stripe customer found');
    return new Response(
      JSON.stringify({
        subscribed: false,
        monthly_spend: localSub?.monthly_spend ?? 0,
        credits_available: 0,
        progress_to_credit: 0,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const customerId = customers.data[0].id;
  logStep('Found Stripe customer', { customerId });

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  });

  // Filter for active or trialing subscriptions only
  const validSubscription = subscriptions.data.find(
    sub => sub.status === 'active' || sub.status === 'trialing'
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

    logStep('Active subscription found', {
      subscriptionId: subscription.id,
      endDate: subscriptionEnd,
      isTrialing,
      trialEnd,
    });

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
  } else {
    logStep('No active subscription found');
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

  return new Response(
    JSON.stringify({
      subscribed: hasActiveSub,
      subscription_end: subscriptionEnd,
      is_trialing: isTrialing,
      trial_end: trialEnd,
      monthly_spend: monthlySpend,
      credits_available: creditsAvailable,
      progress_to_credit: progressToCredit,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});

serve((req) => {
  const initialContext: Partial<CheckSubscriptionContext> = {};

  return handler(req, initialContext);
});
