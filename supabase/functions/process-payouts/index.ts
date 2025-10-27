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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting payout processing...');

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Get all pending payouts with Connect accounts
    const { data: pendingPayouts, error: payoutsError } = await supabaseClient
      .from('payouts')
      .select(`
        *,
        orders (
          id,
          status,
          delivery_date
        )
      `)
      .eq('status', 'pending')
      .not('stripe_connect_account_id', 'is', null)
      .in('recipient_type', ['farmer', 'driver']);

    if (payoutsError) {
      throw payoutsError;
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      console.log('No pending payouts to process');
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending payouts',
        processed: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingPayouts.length} pending payouts`);

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Process each payout
    for (const payout of pendingPayouts) {
      try {
        const order = payout.orders as any;
        
        // Only process payouts for delivered orders
        if (order.status !== 'delivered') {
          console.log(`Skipping payout ${payout.id} - order not delivered yet`);
          continue;
        }

        console.log(`Processing payout ${payout.id} for ${payout.recipient_type}:`, {
          amount: payout.amount,
          account: payout.stripe_connect_account_id
        });

        // Verify Connect account is ready
        const account = await stripe.accounts.retrieve(payout.stripe_connect_account_id);
        
        if (!account.payouts_enabled) {
          console.warn(`Payout account ${payout.stripe_connect_account_id} not enabled for payouts`);
          results.errors.push({
            payout_id: payout.id,
            error: 'PAYOUTS_NOT_ENABLED',
            account_id: payout.stripe_connect_account_id
          });
          continue;
        }

        // Create transfer to Connect account
        const transfer = await stripe.transfers.create({
          amount: Math.round(payout.amount * 100), // Convert to cents
          currency: 'usd',
          destination: payout.stripe_connect_account_id,
          description: payout.description,
          metadata: {
            payout_id: payout.id,
            order_id: payout.order_id,
            recipient_id: payout.recipient_id,
            recipient_type: payout.recipient_type
          }
        });

        console.log('Transfer created:', transfer.id);

        // Update payout record
        await supabaseClient
          .from('payouts')
          .update({
            status: 'completed',
            stripe_transfer_id: transfer.id,
            completed_at: new Date().toISOString()
          })
          .eq('id', payout.id);

        results.successful++;
        console.log(`Payout ${payout.id} completed successfully`);

      } catch (error: any) {
        console.error(`Failed to process payout ${payout.id}:`, error);
        
        results.failed++;
        results.errors.push({
          payout_id: payout.id,
          error: error.message,
          code: error.code
        });

        // Update payout status to failed
        await supabaseClient
          .from('payouts')
          .update({
            status: 'failed',
            description: `${payout.description} - Failed: ${error.message}`
          })
          .eq('id', payout.id);
      }
    }

    console.log('Payout processing completed:', results);

    return new Response(JSON.stringify({
      success: true,
      processed: results.successful + results.failed,
      successful: results.successful,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Payout processing error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
