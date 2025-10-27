import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

    console.log('Checking for expiring trials...');

    // Find subscriptions with trials ending in 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    const eightDaysFromNow = new Date();
    eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

    const { data: expiringTrials, error } = await supabaseClient
      .from('subscriptions')
      .select(`
        id,
        consumer_id,
        trial_end,
        profiles!inner(email, full_name)
      `)
      .eq('status', 'trialing')
      .gte('trial_end', sevenDaysFromNow.toISOString())
      .lt('trial_end', eightDaysFromNow.toISOString());

    if (error) {
      console.error('Error fetching expiring trials:', error);
      throw error;
    }

    console.log(`Found ${expiringTrials?.length || 0} expiring trials`);

    // Send reminder emails
    for (const trial of expiringTrials || []) {
      try {
        const trialEndDate = new Date(trial.trial_end);
        
        await supabaseClient.functions.invoke('send-notification', {
          body: {
            event_type: 'trial_ending',
            recipient_id: trial.consumer_id,
            data: {
              trial_end_date: trialEndDate.toLocaleDateString(),
              days_remaining: 7
            }
          }
        });

        console.log(`Sent trial reminder to user ${trial.consumer_id}`);
      } catch (notifError) {
        console.error(`Failed to send reminder for user ${trial.consumer_id}:`, notifError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      reminders_sent: expiringTrials?.length || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Send trial reminders error:', error);
    return new Response(JSON.stringify({ 
      error: 'SERVER_ERROR',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});