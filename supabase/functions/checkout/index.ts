import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { loadConfig } from '../_shared/config.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { CheckoutService, CheckoutError } from '../_shared/services/CheckoutService.ts';

// Replicate contract schema for edge function validation
const CheckoutRequestSchema = z.object({
  cart_id: z.string().uuid({ message: "Invalid cart ID" }),
  delivery_date: z.string().datetime({ message: "Invalid delivery date format" }),
  use_credits: z.boolean().default(false),
  payment_method_id: z.string().optional(),
  tip_amount: z.number().min(0, { message: "Tip amount must be positive" }).default(0),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Load config
    const config = loadConfig();
    
    const supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ 
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabaseClient, user.id, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      keyPrefix: 'checkout',
    });

    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'TOO_MANY_REQUESTS', 
          message: 'Too many checkout attempts. Please try again later.',
          retryAfter: rateCheck.retryAfter 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate request body
    const body = await req.json();
    const validationResult = CheckoutRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(JSON.stringify({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request format',
        details: validationResult.error.flatten()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const input = validationResult.data;
    const requestId = crypto.randomUUID();

    console.log(`[${requestId}] [CHECKOUT] Processing checkout for user ${user.id}`);

    // Initialize Stripe
    const stripe = new Stripe(config.stripe.secretKey);

    // Initialize service
    const checkoutService = new CheckoutService(supabaseClient, stripe);

    try {
      // Process checkout via service
      const result = await checkoutService.processCheckout({
        cartId: input.cart_id,
        userId: user.id,
        userEmail: user.email!,
        deliveryDate: input.delivery_date,
        useCredits: input.use_credits || false,
        paymentMethodId: input.payment_method_id,
        tipAmount: input.tip_amount || 0,
        requestOrigin: req.headers.get('origin') || ''
      });

      console.log(`[${requestId}] [CHECKOUT] ✅ Success: order ${result.orderId}`);

      return new Response(
        JSON.stringify({
          success: result.success,
          order_id: result.orderId,
          client_secret: result.clientSecret,
          amount_charged: result.amountCharged,
          credits_redeemed: result.creditsRedeemed,
          payment_status: result.paymentStatus
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } catch (error) {
      // Handle CheckoutError with structured error response
      if (error instanceof CheckoutError) {
        console.error(`[${requestId}] [CHECKOUT] ❌ ${error.code}: ${error.message}`);
        
        return new Response(
          JSON.stringify({
            error: error.code,
            message: error.message,
            details: error.details
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Re-throw unexpected errors
      throw error;
    }
  } catch (error: any) {
    console.error('Unhandled checkout error:', error);
    return new Response(JSON.stringify({ 
      error: 'INTERNAL_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
