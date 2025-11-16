import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import {
  createMiddlewareStack,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

/**
 * Escapes HTML special characters to prevent HTML injection
 * @param text - The text to escape
 * @returns The escaped text safe for HTML insertion
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };
  return text.replace(/[&<>]/g, (char) => htmlEscapeMap[char] || char);
}

const NotificationSchema = z.object({
  event_type: z.enum([
    "order_confirmation",
    "order_locked",
    "batch_assigned_driver",
    "batch_assigned_farmer",
    "cutoff_reminder",
    "credits_awarded",
  ]),
  recipient_id: z.string().min(1, { message: "recipient_id is required" }),
  recipient_email: z.string().email().optional(),
  data: z.record(z.any()).default({}),
});

type NotificationInput = z.infer<typeof NotificationSchema>;

interface SendNotificationContext
  extends RequestIdContext,
    CORSContext,
    ValidationContext<NotificationInput>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<SendNotificationContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withValidation(NotificationSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, input } = ctx;
  const { event_type, recipient_id, recipient_email, data } = input;

  console.log(
    `[${requestId}] [SEND-NOTIFICATION] Sending notification`,
    { eventType: event_type, recipientId: recipient_id },
  );

  let toEmail = recipient_email;

  if (!toEmail) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", recipient_id)
      .single();

    if (profileError) {
      console.error(
        `[${requestId}] [SEND-NOTIFICATION] Failed to load profile email`,
        profileError,
      );
      throw profileError;
    }

    toEmail = profile?.email ?? undefined;
  }

  if (!toEmail) {
    return new Response(JSON.stringify({ error: "No email found" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let subject = "";
  let html = "";

  switch (event_type) {
    case "order_confirmation": {
      subject = "Order Confirmed - Blue Harvests";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Thank You for Your Order!</h1>
          <p>Your order has been confirmed and will be delivered on <strong>${data.delivery_date ?? ""}</strong>.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Order Summary</h2>
            <p><strong>Order ID:</strong> ${String(data.order_id ?? "").substring(0, 8)}</p>
            <p><strong>Delivery Date:</strong> ${data.delivery_date ?? ""}</p>
            <p><strong>Total Amount:</strong> $${Number(data.total_amount ?? 0).toFixed(2)}</p>
            ${data.credits_used ? `<p><strong>Credits Used:</strong> $${Number(data.credits_used).toFixed(2)}</p>` : ""}
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
    }
    case "order_locked": {
      subject = "Your Order is Being Prepared - Blue Harvests";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Your Order is Locked and Being Prepared!</h1>
          <p>Your order has been confirmed and assigned to a delivery batch.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${String(data.order_id ?? "").substring(0, 8)}</p>
            <p><strong>Delivery Date:</strong> ${data.delivery_date ?? ""}</p>
          </div>
          <p>Your order cannot be modified at this point. Local farmers are preparing your fresh produce!</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
            Blue Harvests Team
          </p>
        </div>
      `;
      break;
    }
    case "batch_assigned_driver": {
      subject = "New Delivery Batch Assigned - Blue Harvests";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">New Delivery Batch Assigned</h1>
          <p>You have been assigned a new delivery batch.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Batch Number:</strong> #${data.batch_number ?? ""}</p>
            <p><strong>Delivery Date:</strong> ${data.delivery_date ?? ""}</p>
            <p><strong>Number of Stops:</strong> ${data.stop_count ?? ""}</p>
          </div>
          <p>Please log in to your driver dashboard to view the full route details.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
            Blue Harvests Team
          </p>
        </div>
      `;
      break;
    }
    case "batch_assigned_farmer": {
      subject = "Delivery Batch Created - Blue Harvests";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">New Delivery Batch for Collection Point</h1>
          <p>A new delivery batch has been created for your collection point.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Batch Number:</strong> #${data.batch_number ?? ""}</p>
            <p><strong>Delivery Date:</strong> ${data.delivery_date ?? ""}</p>
            <p><strong>Number of Orders:</strong> ${data.order_count ?? ""}</p>
          </div>
          <p style="color: #f59e0b; font-weight: bold;">📦 Please ensure all products are delivered to the collection point between 1-3 PM</p>
          <p>Log in to your dashboard to view the complete product list.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
            Blue Harvests Team
          </p>
        </div>
      `;
      break;
    }
    case "cutoff_reminder": {
      subject = "Reminder: Order Cutoff at Midnight - Blue Harvests";
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
    }
    case "credits_awarded": {
      subject = "You've Earned New Credits - Blue Harvests";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Good News! Credits Added to Your Account</h1>
          <p>You've just received <strong>$${Number(data.amount ?? 0).toFixed(2)}</strong> in Blue Harvests credits.</p>
          <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <p><strong>New Balance:</strong> $${Number(data.new_balance ?? 0).toFixed(2)}</p>
            ${data.description ? `<p><strong>Reason:</strong> ${escapeHtml(String(data.description))}</p>` : ""}
            ${data.expires_at ? `<p><strong>Expires:</strong> ${new Date(String(data.expires_at)).toLocaleDateString()}</p>` : ""}
          </div>
          <p>Apply your credits at checkout to save on your next order.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 40px;">
            Blue Harvests Team
          </p>
        </div>
      `;
      break;
    }
  }

  const emailResponse = await resend.emails.send({
    from: "Blue Harvests <onboarding@resend.dev>",
    to: [toEmail],
    subject,
    html,
  });

  console.log(
    `[${requestId}] [SEND-NOTIFICATION] Email sent successfully`,
    { recipient: toEmail, id: emailResponse.id },
  );

  return new Response(JSON.stringify({ success: true, response: emailResponse }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

serve((req) => {
  const initialContext: Partial<SendNotificationContext> = {};

  return handler(req, initialContext);
});
