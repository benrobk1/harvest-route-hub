import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

import {
  createMiddlewareStack,
  withAdminAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
} from "../_shared/middleware/index.ts";
import type { AdminAuthContext } from "../_shared/middleware/withAdminAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface InviteRequest {
  email: string;
}

interface InviteAdminContext
  extends RequestIdContext,
    CORSContext,
    AdminAuthContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<InviteAdminContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
]);

const handler = stack(async (req, ctx) => {
  const { supabase, user, corsHeaders, requestId, config } = ctx;

  let body: InviteRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { email } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "Invalid email address" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`[${requestId}] [INVITE-ADMIN] Processing invitation for ${email}`);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    return new Response(
      JSON.stringify({ error: "User already exists. Please assign the role directly." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const invitationToken = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error: insertError } = await supabase
    .from("admin_invitations")
    .insert({
      email,
      invitation_token: invitationToken,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    });

  if (insertError) {
    console.error(`[${requestId}] [INVITE-ADMIN] Error storing invitation:`, insertError);
    return new Response(
      JSON.stringify({ error: "Failed to create invitation" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const origin = req.headers.get("origin") || "http://localhost:5173";
  const appUrl = config.supabase.url.replace(/^https:\/\/[^.]+\.supabase\.co/, origin);
  const magicLink = `${appUrl}/admin/accept-invitation?token=${invitationToken}`;

  const emailResponse = await resend.emails.send({
    from: "Blue Harvests <onboarding@resend.dev>",
    to: [email],
    subject: "You've been invited to become an Admin",
    html: `
      <h1>Admin Invitation</h1>
      <p>You've been invited to become an administrator for Blue Harvests.</p>
      <p>Click the link below to accept the invitation and set your password:</p>
      <p><a href="${magicLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Accept Invitation</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p style="color: #666; word-break: break-all;">${magicLink}</p>
      <p style="color: #666; margin-top: 24px; font-size: 14px;">This invitation expires in 7 days.</p>
      <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
    `,
  });

  console.log(`[${requestId}] [INVITE-ADMIN] Email sent successfully`, emailResponse);

  await supabase.rpc("log_admin_action", {
    _action_type: "admin_invited",
    _new_value: { email, expires_at: expiresAt.toISOString() },
  });

  return new Response(
    JSON.stringify({
      success: true,
      message: `Invitation sent to ${email}. They have 7 days to accept.`
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});

serve((req) => {
  const initialContext: Partial<InviteAdminContext> = {};

  return handler(req, initialContext);
});
