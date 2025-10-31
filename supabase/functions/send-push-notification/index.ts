import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { consumerId, message, eta, stopsRemaining } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get consumer's push subscription
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('push_subscription, email, full_name')
      .eq('id', consumerId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Consumer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if notifications are enabled
    if (!profile.push_subscription?.enabled) {
      return new Response(
        JSON.stringify({ error: 'Notifications not enabled for this user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, just log the notification
    // In production, you would use Web Push API with VAPID keys
    console.log('Push notification would be sent:', {
      to: profile.email,
      message,
      eta,
      stopsRemaining,
    });

    // Log the notification attempt
    await supabase
      .from('profiles')
      .update({
        push_subscription: {
          ...profile.push_subscription,
          last_notification: new Date().toISOString(),
        },
      })
      .eq('id', consumerId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Notification logged (push implementation requires VAPID setup)' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
