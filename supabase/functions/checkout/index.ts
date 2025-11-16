<<<<<<< HEAD
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import type { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { requireStripe } from "../_shared/config.ts";
import { CheckoutRequestSchema } from "../_shared/contracts/checkout.ts";
import { CheckoutError, CheckoutService } from "../_shared/services/CheckoutService.ts";
import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withRateLimit,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { AuthContext } from "../_shared/middleware/withAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

interface CheckoutContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    ValidationContext<CheckoutRequest>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<CheckoutContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withRateLimit({
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    keyPrefix: "checkout",
  }),
  withValidation(CheckoutRequestSchema),
]);

const handler = stack(async (req, ctx) => {
  const { supabase, corsHeaders, requestId, user, config, input } = ctx;
  requireStripe(config);

  console.log(
    `[${requestId}] [CHECKOUT] Processing checkout for cart ${input.cart_id}`,
    {
      userId: user.id,
      deliveryDate: input.delivery_date,
      useCredits: input.use_credits ?? false,
    },
  );

  const stripe = new Stripe(config.stripe.secretKey, {});
=======
/**
 * CHECKOUT EDGE FUNCTION
 * Processes cart checkout with payment and credits
 * 
 * Full Middleware Pattern:
 * RequestId + CORS + Auth + RateLimit + Validation + ErrorHandling
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { loadConfig } from '../_shared/config.ts';
import { CheckoutService, CheckoutError } from '../_shared/services/CheckoutService.ts';
import { CheckoutRequestSchema } from '../_shared/contracts/checkout.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit,
  withValidation,
  withErrorHandling,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
} from '../_shared/middleware/index.ts';

type CheckoutInput = {
  cart_id: string;
  delivery_date: string;
  use_credits?: boolean;
  payment_method_id?: string;
  tip_amount?: number;
  is_demo_mode?: boolean;
};

type Context = RequestIdContext & CORSContext & AuthContext & ValidationContext<CheckoutInput>;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, user, input } = ctx;
  
  const config = loadConfig();
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

  console.log(`[${requestId}] Processing checkout for cart ${input.cart_id}`);

  const stripe = new Stripe(config.stripe.secretKey);
>>>>>>> main
  const checkoutService = new CheckoutService(supabase, stripe);

  try {
    const result = await checkoutService.processCheckout({
      cartId: input.cart_id,
      userId: user.id,
<<<<<<< HEAD
      userEmail: user.email ?? "",
      deliveryDate: input.delivery_date,
      useCredits: input.use_credits ?? false,
      paymentMethodId: input.payment_method_id,
      tipAmount: input.tip_amount ?? 0,
      requestOrigin: req.headers.get("origin") ?? "",
      isDemoMode: input.is_demo_mode ?? false,
    });

    console.log(
      `[${requestId}] [CHECKOUT] ✅ Checkout succeeded`,
      { orderId: result.orderId, amountCharged: result.amountCharged },
    );
=======
      userEmail: user.email!,
      deliveryDate: input.delivery_date,
      useCredits: input.use_credits || false,
      paymentMethodId: input.payment_method_id,
      tipAmount: input.tip_amount || 0,
      requestOrigin: req.headers.get('origin') || '',
      isDemoMode: input.is_demo_mode || false
    });

    console.log(`[${requestId}] ✅ Checkout success: order ${result.orderId}`);
>>>>>>> main

    return new Response(
      JSON.stringify({
        success: result.success,
        order_id: result.orderId,
        client_secret: result.clientSecret,
        amount_charged: result.amountCharged,
        credits_redeemed: result.creditsRedeemed,
<<<<<<< HEAD
        payment_status: result.paymentStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      console.error(
        `[${requestId}] [CHECKOUT] Checkout error`,
        { code: error.code, message: error.message, details: error.details },
      );

=======
        payment_status: result.paymentStatus
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    if (error instanceof CheckoutError) {
      console.error(`[${requestId}] ❌ Checkout error [${error.code}]: ${error.message}`);
      
>>>>>>> main
      return new Response(
        JSON.stringify({
          error: error.code,
          message: error.message,
<<<<<<< HEAD
          details: error.details,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    throw error;
  }
});

serve((req) => {
  const initialContext: Partial<CheckoutContext> = {};

  return handler(req, initialContext);
});
=======
          details: error.details
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.CHECKOUT),
  withValidation(CheckoutRequestSchema),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
>>>>>>> main
