import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

/**
 * CHECK STRIPE CONNECT STATUS
 * 
 * Verifies Stripe Connect onboarding status and syncs with local database.
 * High-traffic read endpoint with generous rate limiting.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [CHECK-STRIPE-CONNECT] Request started`);

  try {
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.CHECK_STRIPE_CONNECT);
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

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_connect_account_id) {
      console.log(`[${requestId}] ℹ️ No Stripe account for user ${user.id}`);
      return new Response(JSON.stringify({
        connected: false,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Stripe
    const stripe = new Stripe(config.stripe.secretKey, {
      // Using account default API version for compatibility
    });

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);

    const onboardingComplete = account.details_submitted || false;
    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;

    // Update profile with latest status
    await supabase
      .from('profiles')
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled
      })
      .eq('id', user.id);

    console.log(`[${requestId}] ✅ Stripe Connect status synced for user ${user.id}`, {
      onboardingComplete,
      chargesEnabled,
      payoutsEnabled
    });

    return new Response(JSON.stringify({
      connected: true,
      onboarding_complete: onboardingComplete,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      account_id: profile.stripe_connect_account_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Check Stripe Connect error:`, error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message,
      code: 'STRIPE_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
