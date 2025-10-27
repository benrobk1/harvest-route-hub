import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Stripe Connect onboarding request for user:', user.id);

    // Verify user is farmer or driver
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    const isFarmerOrDriver = roles.includes('farmer') || roles.includes('lead_farmer') || roles.includes('driver');

    if (!isFarmerOrDriver) {
      return new Response(JSON.stringify({ 
        error: 'INVALID_ROLE',
        message: 'Only farmers and drivers can connect Stripe accounts'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_connect_account_id, email, full_name')
      .eq('id', user.id)
      .single();

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    let accountId = profile?.stripe_connect_account_id;

    // Create Connect account if doesn't exist
    if (!accountId) {
      console.log('Creating new Stripe Connect account...');
      
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
      console.log('Created Stripe Connect account:', accountId);

      // Update profile with account ID
      await supabaseClient
        .from('profiles')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', user.id);
    }

    // Create account link for onboarding
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/profile`,
      return_url: `${origin}/profile?stripe_onboarding=success`,
      type: 'account_onboarding',
    });

    console.log('Account link created:', accountLink.url);

    return new Response(JSON.stringify({
      success: true,
      url: accountLink.url,
      account_id: accountId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Stripe Connect onboarding error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
