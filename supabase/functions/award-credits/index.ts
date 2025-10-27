import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AwardCreditsRequest {
  consumer_id: string;
  amount: number;
  description: string;
  transaction_type?: 'earned' | 'bonus' | 'refund';
  expires_in_days?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      consumer_id, 
      amount, 
      description, 
      transaction_type = 'earned',
      expires_in_days = 90 
    }: AwardCreditsRequest = await req.json();

    console.log('Awarding credits:', { consumer_id, amount, description, transaction_type });

    // Validate inputs
    if (!consumer_id || !amount || amount <= 0) {
      return new Response(JSON.stringify({
        error: 'INVALID_INPUT',
        message: 'Consumer ID and positive amount required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current credit balance
    const { data: latestCredit } = await supabaseClient
      .from('credits_ledger')
      .select('balance_after')
      .eq('consumer_id', consumer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = latestCredit?.balance_after || 0;
    const newBalance = currentBalance + amount;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Insert credit transaction
    const { data: creditRecord, error: creditError } = await supabaseClient
      .from('credits_ledger')
      .insert({
        consumer_id,
        transaction_type,
        amount,
        balance_after: newBalance,
        description,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (creditError) {
      console.error('Failed to award credits:', creditError);
      throw creditError;
    }

    console.log('Credits awarded successfully:', creditRecord.id);

    // Send notification to user
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          event_type: 'credits_awarded',
          recipient_id: consumer_id,
          data: {
            amount,
            new_balance: newBalance,
            description,
            expires_at: expiresAt.toISOString()
          }
        }
      });
    } catch (notifError) {
      console.error('Notification failed (non-blocking):', notifError);
    }

    return new Response(JSON.stringify({
      success: true,
      credit_id: creditRecord.id,
      amount_awarded: amount,
      new_balance: newBalance,
      expires_at: expiresAt.toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Award credits error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
