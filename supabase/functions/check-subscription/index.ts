import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { 
  withRequestId, 
  withCORS, 
  withAuth,
  withRateLimit,
  withErrorHandling, 
  withMetrics,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type MetricsContext
} from '../_shared/middleware/index.ts';

/**
 * CHECK SUBSCRIPTION EDGE FUNCTION
 * 
 * Verifies active Stripe subscription and syncs with local database.
 * High-traffic endpoint - read-heavy with aggressive rate limiting.
 */

<<<<<<< HEAD
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
=======
type Context = RequestIdContext & CORSContext & AuthContext & MetricsContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('subscription_check_started');
  
  const config = loadConfig();
  const supabaseClient = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    { auth: { persistSession: false } }
  );

  const user = ctx.user;
  if (!user.email) {
    throw new Error('User email not available');
  }

  console.log(`[${ctx.requestId}] Checking subscription for user: ${user.id}`);
  
  // Get local subscription data
  const { data: localSub } = await supabaseClient
    .from('subscriptions')
    .select('*')
    .eq('consumer_id', user.id)
    .single();

  ctx.metrics.mark('local_data_fetched');

  // Lookup Stripe customer by email
  const stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2023-10-16',
  });
  
  const customers = await stripe.customers.list({ email: user.email, limit: 1 });
  
  if (customers.data.length === 0) {
    console.log(`[${ctx.requestId}] ℹ️ No Stripe customer for ${user.email}`);
    ctx.metrics.mark('no_stripe_customer');
    return new Response(JSON.stringify({ 
      subscribed: false,
      monthly_spend: localSub?.monthly_spend || 0,
      credits_available: 0,
      progress_to_credit: 0
    }), {
      headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const customerId = customers.data[0].id;
  ctx.metrics.mark('stripe_customer_found');

  // Check for active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  
  const hasActiveSub = subscriptions.data.length > 0;
  let subscriptionEnd = null;
  let trialEnd = null;
  let isTrialing = false;

  if (hasActiveSub) {
    const subscription = subscriptions.data[0];
    
    subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    isTrialing = subscription.status === 'trialing';
    
    if (subscription.trial_end) {
      trialEnd = new Date(subscription.trial_end * 1000).toISOString();
    }
    
    ctx.metrics.mark('active_subscription_found');
    
    // Sync to local database
    await supabaseClient
      .from('subscriptions')
      .upsert({
        consumer_id: user.id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        status: isTrialing ? 'trialing' : 'active',
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: subscriptionEnd,
        trial_end: trialEnd,
        monthly_spend: localSub?.monthly_spend || 0,
        credits_earned: localSub?.credits_earned || 0,
      }, { onConflict: 'consumer_id' });
    
    ctx.metrics.mark('subscription_synced');
  }

  // Calculate available credits
  const { data: availableCredits } = await supabaseClient
    .from('credits_ledger')
    .select('balance_after')
    .eq('consumer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const creditsAvailable = availableCredits?.[0]?.balance_after || 0;

  // Monthly spend progress
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlySpend = localSub?.monthly_spend_period === currentMonth ? (localSub?.monthly_spend || 0) : 0;
  const progressToCredit = Math.min((monthlySpend / 100) * 100, 100);

  console.log(`[${ctx.requestId}] ✅ Subscription check complete`, { 
    hasActiveSub, 
    isTrialing,
    creditsAvailable 
  });
  
  ctx.metrics.mark('check_complete');

  return new Response(JSON.stringify({
    subscribed: hasActiveSub,
    subscription_end: subscriptionEnd,
    is_trialing: isTrialing,
    trial_end: trialEnd,
    monthly_spend: monthlySpend,
    credits_available: creditsAvailable,
    progress_to_credit: progressToCredit,
  }), {
    headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.CHECK_SUBSCRIPTION),
  withMetrics('check-subscription'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
>>>>>>> main
