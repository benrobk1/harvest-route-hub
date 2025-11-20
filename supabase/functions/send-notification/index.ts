/**
 * SEND NOTIFICATION EDGE FUNCTION
 * 
 * Sends email notifications for various events (orders, batches, reminders).
 * Requires authentication and uses Resend for email delivery.
 * 
 * Middleware Stack:
 * 1. Request ID (correlation logging)
 * 2. CORS (origin validation)
 * 3. Authentication (JWT validation)
 * 4. Rate Limiting (per-user limits)
 * 5. Validation (Zod schema)
 * 6. Error Handling (standardized responses)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { RATE_LIMITS } from '../_shared/constants.ts';
import { SendNotificationRequestSchema, type SendNotificationRequest } from '../_shared/contracts/notifications.ts';
import {
  createMiddlewareStack,
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit,
  withValidation,
  withErrorHandling,
  withSupabaseServiceRole,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
  type SupabaseServiceRoleContext,
} from '../_shared/middleware/index.ts';

// Context type includes all middleware contexts
type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  ValidationContext<SendNotificationRequest> &
  SupabaseServiceRoleContext;

// Main handler with middleware-injected context
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, user, supabase, input, config } = ctx;
  const { event_type, recipient_id, recipient_email, data } = input;

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

      case 'customer_delivery_update':
        subject = `📦 Update About Your Delivery - Blue Harvests`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">📦 Delivery Update</h1>
            <p>Hello,</p>
            <p>We wanted to keep you informed about your upcoming delivery.</p>
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h2 style="margin-top: 0; color: #92400e;">${data.title || 'Delivery Information'}</h2>
              <p style="margin: 0; color: #78350f;">${data.description || 'There has been an update regarding your delivery.'}</p>
            </div>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">What This Means</h3>
              <p style="margin: 10px 0;">
                Our delivery team is working diligently to ensure your order arrives safely. We apologize for the inconvenience this may cause.
              </p>
              <p style="margin: 10px 0;">
                <strong>What you can do:</strong>
              </p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Track your order status in your account dashboard</li>
                <li>Contact our support team if you have questions</li>
                <li>We'll send you another update when the issue is resolved</li>
              </ul>
            </div>
            <p style="margin: 30px 0;">
              <a href="${config.supabase.url.replace('//', '//app.')}/consumer/orders" 
                 style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                View My Orders
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
              Thank you for your patience and for supporting local farms!<br>
              Blue Harvests Team
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
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withRateLimit(RATE_LIMITS.SEND_NOTIFICATION),
  withValidation(SendNotificationRequestSchema),
  withErrorHandling
]);

// Serve with composed middleware
serve((req) => middlewareStack(handler)(req, {} as Context));
