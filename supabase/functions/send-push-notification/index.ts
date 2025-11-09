import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { SendPushNotificationRequestSchema } from '../_shared/contracts/notifications.ts';

/**
 * SEND PUSH NOTIFICATION EDGE FUNCTION
 * 
 * Sends push notifications to users (drivers/consumers).
 * Includes aggressive rate limiting to protect push service quotas.
 * Note: Requires VAPID setup for production Web Push API.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [SEND-PUSH-NOTIFICATION] Request started`);

  try {
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData.user;
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate input
    const body = await req.json();
    const result = SendPushNotificationRequestSchema.safeParse(body);

    if (!result.success) {
      return new Response(JSON.stringify({
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.flatten(),
        code: 'VALIDATION_ERROR',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { user_id, title, body: messageBody, data } = result.data;

    console.log(`[${requestId}] Push notification request:`, { user_id, title });

    // AGGRESSIVE RATE LIMITING: Protect push service quotas (FCM/APNS limits)
    // 20 notifications per hour per user prevents spam and quota exhaustion
    const rateCheck = await checkRateLimit(supabase, user_id, RATE_LIMITS.SEND_PUSH_NOTIFICATION);
    
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] ⚠️ Rate limit exceeded for user ${user_id}`);
      return new Response(JSON.stringify({ 
        error: 'TOO_MANY_REQUESTS',
        message: 'Notification rate limit exceeded.',
        retryAfter: rateCheck.retryAfter,
        code: 'TOO_MANY_REQUESTS',
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60),
        }
      });
    }

    // Get user's push subscription
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('push_subscription, email, full_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error(`[${requestId}] ❌ User not found: ${user_id}`);
      return new Response(JSON.stringify({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if notifications are enabled
    if (!profile.push_subscription?.enabled) {
      console.log(`[${requestId}] ℹ️ Notifications not enabled for user ${user_id}`);
      return new Response(JSON.stringify({ 
        error: 'Notifications not enabled for this user',
        code: 'NOTIFICATIONS_DISABLED'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // TODO: Implement Web Push API with VAPID keys
    // For now, just log the notification
    console.log(`[${requestId}] 📱 Push notification (logged):`, {
      to: profile.email,
      title,
      body: messageBody,
      data,
    });

    // Update last notification timestamp
    await supabase
      .from('profiles')
      .update({
        push_subscription: {
          ...profile.push_subscription,
          last_notification: new Date().toISOString(),
        },
      })
      .eq('id', user_id);

    console.log(`[${requestId}] ✅ Notification logged successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Notification logged (push implementation requires VAPID setup)' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Push notification error:`, error);
    return new Response(JSON.stringify({ 
      error: error.message,
      code: 'SERVER_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
