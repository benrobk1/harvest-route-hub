import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check local subscription record first
    const { data: localSub } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('consumer_id', user.id)
      .single();

    logStep("Local subscription fetched", { localSub });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
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
    logStep("Found Stripe customer", { customerId });

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
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        isTrialing,
        trialEnd
      });

      // Update local subscription record
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
    } else {
      logStep("No active subscription found");
    }

    // Calculate available credits (not expired)
    const { data: availableCredits } = await supabaseClient
      .from('credits_ledger')
      .select('balance_after')
      .eq('consumer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const creditsAvailable = availableCredits?.[0]?.balance_after || 0;

    // Get current month's spend
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlySpend = localSub?.monthly_spend_period === currentMonth ? (localSub?.monthly_spend || 0) : 0;
    const progressToCredit = Math.min((monthlySpend / 100) * 100, 100);

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
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
