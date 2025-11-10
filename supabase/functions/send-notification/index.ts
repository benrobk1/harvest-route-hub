import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { SendNotificationRequestSchema } from '../_shared/contracts/notifications.ts';

/**
 * SEND NOTIFICATION EDGE FUNCTION
 * 
 * Sends email notifications for various events (orders, batches, reminders).
 * Requires authentication and uses Resend for email delivery.
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
  console.log(`[${requestId}] [SEND-NOTIFICATION] Request started`);

  try {
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Authenticate user (admin or system)
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

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.SEND_NOTIFICATION);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] ⚠️ Rate limit exceeded for user ${user.id}`);
      return new Response(JSON.stringify({ 
        error: 'TOO_MANY_REQUESTS', 
        message: 'Too many requests. Please try again later.',
        retryAfter: rateCheck.retryAfter,
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60),
        }
      });
    }

    // Validate input
    const body = await req.json();
    const result = SendNotificationRequestSchema.safeParse(body);

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

    const { event_type, recipient_id, recipient_email, data } = result.data;

    console.log(`[${requestId}] Sending notification:`, { event_type, recipient_id });

    // Get recipient email if not provided
    let toEmail = recipient_email;
    if (!toEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', recipient_id)
        .single();
      
      toEmail = profile?.email;
    }

    if (!toEmail) {
      console.error(`[${requestId}] ❌ No email found for recipient: ${recipient_id}`);
      return new Response(JSON.stringify({ 
        error: 'No email found',
        code: 'NO_EMAIL_FOUND'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let subject = '';
    let html = '';

    // Generate email based on event type
    switch (event_type) {
      case 'order_confirmation':
        subject = 'Order Confirmed - Blue Harvests';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Thank You for Your Order!</h1>
            <p>Your order has been confirmed and will be delivered on <strong>${data.delivery_date}</strong>.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Order Summary</h2>
              <p><strong>Order ID:</strong> ${data.order_id?.substring(0, 8)}</p>
              <p><strong>Delivery Date:</strong> ${data.delivery_date}</p>
              <p><strong>Total Amount:</strong> $${data.total_amount?.toFixed(2)}</p>
              ${data.credits_used ? `<p><strong>Credits Used:</strong> $${data.credits_used.toFixed(2)}</p>` : ''}
            </div>
            <p style="color: #f59e0b; font-weight: bold;">⏰ Orders lock at midnight the day before delivery</p>
            <p>You can track your order status in your account dashboard.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Thank you for supporting local farms!<br>
              Blue Harvests Team
            </p>
          </div>
        `;
        break;

      case 'order_locked':
        subject = 'Your Order is Being Prepared - Blue Harvests';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Your Order is Locked and Being Prepared!</h1>
            <p>Your order has been confirmed and assigned to a delivery batch.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Order ID:</strong> ${data.order_id?.substring(0, 8)}</p>
              <p><strong>Delivery Date:</strong> ${data.delivery_date}</p>
            </div>
            <p>Your order cannot be modified at this point. Local farmers are preparing your fresh produce!</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Blue Harvests Team
            </p>
          </div>
        `;
        break;

      case 'batch_assigned_driver':
        subject = 'New Delivery Batch Assigned - Blue Harvests';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">New Delivery Batch Assigned</h1>
            <p>You have been assigned a new delivery batch.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Batch Number:</strong> #${data.batch_number}</p>
              <p><strong>Delivery Date:</strong> ${data.delivery_date}</p>
              <p><strong>Number of Stops:</strong> ${data.stop_count}</p>
            </div>
            <p>Please log in to your driver dashboard to view the full route details.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Blue Harvests Team
            </p>
          </div>
        `;
        break;

      case 'batch_assigned_farmer':
        subject = 'Delivery Batch Created - Blue Harvests';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">New Delivery Batch for Collection Point</h1>
            <p>A new delivery batch has been created for your collection point.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Batch Number:</strong> #${data.batch_number}</p>
              <p><strong>Delivery Date:</strong> ${data.delivery_date}</p>
              <p><strong>Number of Orders:</strong> ${data.order_count}</p>
            </div>
            <p style="color: #f59e0b; font-weight: bold;">📦 Please ensure all products are delivered to the collection point between 1-3 PM</p>
            <p>Log in to your dashboard to view the complete product list.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Blue Harvests Team
            </p>
          </div>
        `;
        break;

      case 'cutoff_reminder':
        subject = 'Reminder: Order Cutoff at Midnight - Blue Harvests';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f59e0b;">⏰ Order Cutoff Reminder</h1>
            <p>This is a reminder that orders for tomorrow's delivery will be locked at <strong>midnight tonight</strong>.</p>
            <p>If you have items in your cart or want to make changes to your pending order, please do so before the cutoff time.</p>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e;">Orders cannot be modified after midnight. Make sure to complete your checkout!</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Blue Harvests Team
            </p>
          </div>
        `;
        break;

      case 'admin_alert':
        subject = `🚨 ${data.title || 'Delivery Issue Alert'}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">🚨 Delivery Issue Reported</h1>
            <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0; color: #991b1b;">${data.title}</h2>
              <p style="margin: 10px 0;"><strong>Category:</strong> ${data.category?.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
              <p style="margin: 10px 0;"><strong>Severity:</strong> ${data.severity?.toUpperCase()}</p>
              <p style="margin: 10px 0;"><strong>Reported by:</strong> ${data.reporter_type?.replace('_', ' ')}</p>
            </div>
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Description</h3>
              <p style="white-space: pre-wrap;">${data.description}</p>
            </div>
            <p style="margin: 30px 0;">
              <a href="${config.supabase.url.replace('//', '//app.')}/admin/delivery-issues" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                View Issue in Dashboard
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Issue ID: ${data.issue_id?.substring(0, 8)}<br>
              Please respond promptly to ensure smooth operations.<br>
              Blue Harvests Admin Team
            </p>
          </div>
        `;
        break;

      default:
        throw new Error(`Unknown event type: ${event_type}`);
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.warn(`[${requestId}] ⚠️ RESEND_API_KEY not configured - notification not sent`);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Email service not configured',
        code: 'NOTIFICATION_ERROR'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);
    const emailResponse = await resend.emails.send({
      from: "Blue Harvests <onboarding@resend.dev>",
      to: [toEmail],
      subject,
      html,
    });

    console.log(`[${requestId}] ✅ Email sent successfully:`, emailResponse);

    return new Response(JSON.stringify({ 
      success: true,
      response: emailResponse
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Notification error:`, error);
    return new Response(JSON.stringify({ 
      error: 'NOTIFICATION_ERROR',
      message: error.message,
      code: 'NOTIFICATION_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
