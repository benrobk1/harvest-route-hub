import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { RATE_LIMITS } from '../_shared/constants.ts';
import { StripeConnectOnboardRequestSchema } from '../_shared/contracts/stripe.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withValidation,
  withRateLimit,
  withErrorHandling,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';

/**
 * STRIPE CONNECT ONBOARDING
 * 
 * Creates Stripe Connect accounts and generates onboarding links.
 * Only farmers and drivers can initiate onboarding.
 */

type StripeConnectOnboardInput = { origin?: string; returnPath?: string };
type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  ValidationContext<StripeConnectOnboardInput> &
  SupabaseServiceRoleContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { config, supabase, user, input: body } = ctx;

  // Verify user is farmer or driver
  const { data: userRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const roles = userRoles?.map(r => r.role) || [];
  const isFarmerOrDriver = roles.includes('farmer') || roles.includes('lead_farmer') || roles.includes('driver');

  if (!isFarmerOrDriver) {
    console.warn(`[${ctx.requestId}] ⚠️ Invalid role for user ${user.id}: ${roles.join(', ')}`);
    return new Response(JSON.stringify({ 
      error: 'INVALID_ROLE',
      message: 'Only farmers and drivers can connect Stripe accounts',
      code: 'INVALID_ROLE'
    }), {
      status: 403,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
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
    console.log(`[${ctx.requestId}] Creating new Stripe Connect account...`);
    
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
    console.log(`[${ctx.requestId}] Created Stripe Connect account: ${accountId}`);

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

  console.log(`[${ctx.requestId}] ✅ Account link created for ${accountId}`);

  return new Response(JSON.stringify({
    success: true,
    url: accountLink.url,
    account_id: accountId
  }), {
    status: 200,
    headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withRateLimit(RATE_LIMITS.STRIPE_CONNECT_ONBOARD),
  withValidation(StripeConnectOnboardRequestSchema),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as Context));
