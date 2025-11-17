import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { SendPushNotificationRequestSchema } from '../_shared/contracts/notifications.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withValidation,
  withRateLimit,
  withErrorHandling,
  withMetrics,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type MetricsContext,
  type SupabaseServiceRoleContext,
  type ValidationContext
} from '../_shared/middleware/index.ts';

/**
 * SEND PUSH NOTIFICATION EDGE FUNCTION
 * 
 * Sends push notifications to users (drivers/consumers).
 * Uses middleware pattern with aggressive rate limiting.
 * Note: Requires VAPID setup for production Web Push API.
 */

type SendPushRequest = {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
};

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  MetricsContext &
  ValidationContext<SendPushRequest> &
  SupabaseServiceRoleContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('notification_requested');
  
  const { supabase } = ctx;

  const { user_id, title, body: messageBody, data } = ctx.input;

  console.log(`[${ctx.requestId}] Push notification request:`, { user_id, title });

  // Get user's push subscription
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('push_subscription, email, full_name')
    .eq('id', user_id)
    .single();

  if (profileError || !profile) {
    console.error(`[${ctx.requestId}] ❌ User not found: ${user_id}`);
    ctx.metrics.mark('user_not_found');
    return new Response(JSON.stringify({ 
      error: 'User not found',
      code: 'USER_NOT_FOUND'
    }), {
      status: 404,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check if notifications are enabled
  if (!profile.push_subscription?.enabled) {
    console.log(`[${ctx.requestId}] ℹ️ Notifications not enabled for user ${user_id}`);
    ctx.metrics.mark('notifications_disabled');
    return new Response(JSON.stringify({ 
      error: 'Notifications not enabled for this user',
      code: 'NOTIFICATIONS_DISABLED'
    }), {
      status: 400,
      headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // TODO: Implement Web Push API with VAPID keys
  // For now, just log the notification
  console.log(`[${ctx.requestId}] 📱 Push notification (logged):`, {
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

  console.log(`[${ctx.requestId}] ✅ Notification logged successfully`);
  ctx.metrics.mark('notification_sent');

  return new Response(JSON.stringify({ 
    success: true,
    message: 'Notification logged (push implementation requires VAPID setup)' 
  }), {
    status: 200,
    headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' }
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withValidation(SendPushNotificationRequestSchema),
  withRateLimit(RATE_LIMITS.SEND_PUSH_NOTIFICATION),
  withMetrics('send-push-notification'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
