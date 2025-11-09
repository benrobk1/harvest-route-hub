/**
 * CREATE SUBSCRIPTION CHECKOUT EDGE FUNCTION
 * Creates Stripe checkout session for subscription with optional trial
 * 
 * Middleware Pattern:
 * - Request ID logging
 * - Authentication
 * - Rate limiting
 * - Input validation
 * - Stripe integration
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema
const CreateSubscriptionCheckoutSchema = z.object({
  enable_trial: z.boolean().optional().default(false),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // REQUEST ID - Correlation for logs
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [CREATE-SUBSCRIPTION-CHECKOUT] Request started`);

  try {
    // CONFIG LOADING
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);

    // AUTHENTICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] Missing authorization header`);
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error(`[${requestId}] Authentication failed:`, authError?.message);
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user.email) {
      throw new Error('User email not available');
    }

    console.log(`[${requestId}] Authenticated user: ${user.id}`);

    // RATE LIMITING
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.CREATE_SUBSCRIPTION);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({
          error: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
          retryAfter: rateCheck.retryAfter,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60),
          },
        }
      );
    }

    // INPUT VALIDATION
    const body = await req.json().catch(() => ({ enable_trial: false }));
    const validation = CreateSubscriptionCheckoutSchema.safeParse(body);

    if (!validation.success) {
      console.warn(`[${requestId}] Validation failed:`, validation.error.flatten());
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validation.error.flatten(),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const input = validation.data;

    // BUSINESS LOGIC - Stripe checkout creation
    console.log(`[${requestId}] Creating subscription checkout for user ${user.id}`);

    const stripe = new Stripe(config.stripe.secretKey, {
      // Using account default API version for compatibility
    });

    // Check for existing customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;
    console.log(`[${requestId}] Stripe customer: ${customerId || 'new'}`);

    // Create checkout session config
    const sessionConfig: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: 'price_1SMh7wDipsIpa8WwwtVag1ej',
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/consumer/shop?subscription=success`,
      cancel_url: `${req.headers.get('origin')}/consumer/shop?subscription=cancelled`,
    };

    // Add trial if requested
    if (input.enable_trial) {
      sessionConfig.subscription_data = {
        trial_period_days: 60, // 2 months
      };
      console.log(`[${requestId}] Trial enabled: 60 days`);
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log(`[${requestId}] ✅ Checkout session created: ${session.id}`);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error(`[create-subscription-checkout] Error:`, error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
