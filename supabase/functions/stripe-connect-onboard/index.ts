import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

interface StripeOnboardContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<StripeOnboardContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
]);

const handler = stack(async (req, ctx) => {
  const { supabase, user, corsHeaders, requestId, config } = ctx;

  console.log(`[${requestId}] [STRIPE-CONNECT-ONBOARD] Request from user ${user.id}`);

  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (rolesError) {
    console.error(`[${requestId}] [STRIPE-CONNECT-ONBOARD] Failed to load roles:`, rolesError);
    return new Response(JSON.stringify({ error: 'Failed to verify user roles' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const roles = userRoles?.map((r) => r.role) ?? [];
  const isFarmerOrDriver = roles.some((role) => ['farmer', 'lead_farmer', 'driver'].includes(role));

  if (!isFarmerOrDriver) {
    return new Response(JSON.stringify({
      error: 'INVALID_ROLE',
      message: 'Only farmers and drivers can connect Stripe accounts',
      debug: { roles, userId: user.id },
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const profilePath = roles.includes('driver')
    ? '/driver/profile'
    : roles.some((role) => role === 'farmer' || role === 'lead_farmer')
      ? '/farmer/profile'
      : '/profile';

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_connect_account_id, email, full_name')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error(`[${requestId}] [STRIPE-CONNECT-ONBOARD] Failed to load profile:`, profileError);
    return new Response(JSON.stringify({ error: 'Failed to load profile' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(config.stripe.secretKey, {});

  let accountId = profile?.stripe_connect_account_id ?? undefined;

  if (!accountId) {
    console.log(`[${requestId}] [STRIPE-CONNECT-ONBOARD] Creating new Stripe Connect account`);
    const account = await stripe.accounts.create({
      type: 'express',
      email: profile?.email || user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      metadata: {
        supabase_user_id: user.id,
        roles: roles.join(','),
      },
    });

    accountId = account.id;

    await supabase
      .from('profiles')
      .update({ stripe_connect_account_id: accountId })
      .eq('id', user.id);
  }

  const origin = req.headers.get('origin') || 'http://localhost:3000';
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}${profilePath}`,
    return_url: `${origin}${profilePath}?stripe_onboarding=success`,
    type: 'account_onboarding',
  });

  console.log(`[${requestId}] [STRIPE-CONNECT-ONBOARD] Created account link ${accountLink.url}`);

  return new Response(JSON.stringify({
    success: true,
    url: accountLink.url,
    account_id: accountId,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

serve((req) => {
  const initialContext: Partial<StripeOnboardContext> = {};

  return handler(req, initialContext);
});
