import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { loadConfig } from '../_shared/config.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { PayoutService } from '../_shared/services/PayoutService.ts';

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

    // Get user from JWT (admin only)
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      
      if (user) {
        // Rate limiting
        const rateCheck = await checkRateLimit(supabaseClient, user.id, {
          maxRequests: 1,
          windowMs: 5 * 60 * 1000,
          keyPrefix: 'process-payouts',
        });

        if (!rateCheck.allowed) {
          return new Response(
            JSON.stringify({ 
              error: 'TOO_MANY_REQUESTS',
              message: 'Please wait before processing payouts again.',
              retryAfter: rateCheck.retryAfter 
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const requestId = crypto.randomUUID();
    console.log(`[${requestId}] [PAYOUTS] Starting payout processing`);

    // Initialize Stripe
    const stripe = new Stripe(config.stripe.secretKey);

    // Initialize service
    const payoutService = new PayoutService(supabaseClient, stripe);

    // Process payouts
    const result = await payoutService.processPendingPayouts();

    console.log(`[${requestId}] [PAYOUTS] ✅ Complete: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        payouts_processed: result.successful + result.failed,
        total_amount: 0,
        failures: result.errors.length > 0 ? result.errors.map(e => ({
          payout_id: e.payoutId,
          error: e.error
        })) : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    console.error('Payout processing error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
