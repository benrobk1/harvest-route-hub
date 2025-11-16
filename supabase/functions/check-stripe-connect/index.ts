import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

interface CheckStripeContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CheckStripeContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, user, corsHeaders, requestId, config } = ctx;
  requireStripe(config);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(`[${requestId}] [CHECK-STRIPE-CONNECT] Failed to load profile`, profileError);
    throw profileError;
  }

  if (!profile?.stripe_connect_account_id) {
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

  const stripe = new Stripe(config.stripe.secretKey, {});
  const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);

  const onboardingComplete = account.details_submitted ?? false;
  const chargesEnabled = account.charges_enabled ?? false;
  const payoutsEnabled = account.payouts_enabled ?? false;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_onboarding_complete: onboardingComplete,
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled
    })
    .eq('id', user.id);

  if (updateError) {
    console.error(`[${requestId}] [CHECK-STRIPE-CONNECT] Failed to update profile`, updateError);
    throw updateError;
  }

  console.log(`[${requestId}] [CHECK-STRIPE-CONNECT] Updated status for user ${user.id}`, {
    onboardingComplete,
    chargesEnabled,
    payoutsEnabled,
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
});

serve((req) => {
  const initialContext: Partial<CheckStripeContext> = {};

  return handler(req, initialContext);
});
