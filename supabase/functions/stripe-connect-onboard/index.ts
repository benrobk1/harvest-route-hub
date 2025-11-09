import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { StripeConnectOnboardRequestSchema } from '../_shared/contracts/stripe.ts';

/**
 * STRIPE CONNECT ONBOARDING
 * 
 * Creates Stripe Connect accounts and generates onboarding links.
 * Only farmers and drivers can initiate onboarding.
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
  console.log(`[${requestId}] [STRIPE-CONNECT-ONBOARD] Request started`);

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
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.STRIPE_CONNECT_ONBOARD);
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

    // Validate input (optional body)
    let body: any = {};
    try {
      const rawBody = await req.json();
      const validationResult = StripeConnectOnboardRequestSchema.safeParse(rawBody);
      if (validationResult.success) {
        body = validationResult.data;
      }
    } catch (_) {
      body = {};
    }

    // Verify user is farmer or driver
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    const isFarmerOrDriver = roles.includes('farmer') || roles.includes('lead_farmer') || roles.includes('driver');

    if (!isFarmerOrDriver) {
      console.warn(`[${requestId}] ⚠️ Invalid role for user ${user.id}: ${roles.join(', ')}`);
      return new Response(JSON.stringify({ 
        error: 'INVALID_ROLE',
        message: 'Only farmers and drivers can connect Stripe accounts',
        code: 'INVALID_ROLE'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_connect_account_id, email, full_name')
      .eq('id', user.id)
      .single();

    // Initialize Stripe
    const stripe = new Stripe(config.stripe.secretKey, {
      // Using account default API version
    });

    let accountId = profile?.stripe_connect_account_id;

    // Create Connect account if doesn't exist
    if (!accountId) {
      console.log(`[${requestId}] Creating new Stripe Connect account...`);
      
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile?.email || user.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          supabase_user_id: user.id,
          roles: roles.join(',')
        }
      });

      accountId = account.id;
      console.log(`[${requestId}] Created Stripe Connect account: ${accountId}`);

      // Update profile with account ID
      await supabase
        .from('profiles')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', user.id);
    }

    // Create account link for onboarding
    const headerOrigin = req.headers.get('origin') || '';
    const baseOrigin = body.origin || headerOrigin || 'http://localhost:3000';
    const defaultPath = roles.includes('driver') ? '/driver/profile' : '/farmer/profile';
    const returnPath = body.returnPath || defaultPath;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseOrigin}${returnPath}`,
      return_url: `${baseOrigin}${returnPath}?stripe_onboarding=success`,
      type: 'account_onboarding',
    });

    console.log(`[${requestId}] ✅ Account link created for ${accountId}`);

    return new Response(JSON.stringify({
      success: true,
      url: accountLink.url,
      account_id: accountId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Stripe Connect onboarding error:`, error);
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
