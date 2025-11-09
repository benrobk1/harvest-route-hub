import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

/**
 * CHECK SUBSCRIPTION EDGE FUNCTION
 * 
 * Verifies active Stripe subscription and syncs with local database.
 * Very high-traffic endpoint (100 req/15min) - read-heavy.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [CHECK-SUBSCRIPTION] Request started`);

  try {
    const config = loadConfig();
    
    // Dual client pattern: anon for auth, service role for DB
    const supabaseAuth = createClient(
      config.supabase.url,
      config.supabase.anonKey,
      { auth: { persistSession: false } }
    );

    const supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError) {
      return new Response(JSON.stringify({ error: userError.message, code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: 'User not authenticated', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabaseClient, user.id, RATE_LIMITS.CHECK_SUBSCRIPTION);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] ⚠️ Rate limit exceeded for user ${user.id}`);
      return new Response(JSON.stringify({ 
        error: 'TOO_MANY_REQUESTS', 
        message: 'Too many requests. Please try again later.',
        retryAfter: rateCheck.retryAfter,
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60),
        }
      });
    }

    // Get local subscription data
    const { data: localSub } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('consumer_id', user.id)
      .single();

    // Lookup Stripe customer by email
    const stripe = new Stripe(config.stripe.secretKey, {
      // Using account default API version
    });
    
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      console.log(`[${requestId}] ℹ️ No Stripe customer for ${user.email}`);
      return new Response(JSON.stringify({ 
        subscribed: false,
        monthly_spend: localSub?.monthly_spend || 0,
        credits_available: 0,
        progress_to_credit: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;

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

    console.log(`[${requestId}] ✅ Subscription check complete for ${user.id}`, { hasActiveSub });

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${requestId}] ❌ Check subscription error:`, errorMessage);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      code: 'SERVER_ERROR'
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
