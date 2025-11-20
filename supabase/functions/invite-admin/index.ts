import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import {
  withRequestId,
  withCORS,
  withAdminAuth,
  withValidation,
  withErrorHandling,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';

/**
 * INVITE ADMIN EDGE FUNCTION
 * 
 * Admin-only endpoint for inviting new administrators.
 * Sends invitation email with secure token.
 */

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Validation schema
const InviteRequestSchema = z.object({
  email: z.string().email("Invalid email address").max(255, "Email too long"),
});

type InviteRequest = z.infer<typeof InviteRequestSchema>;

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  ValidationContext<InviteRequest> &
  SupabaseServiceRoleContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { config, supabase, user, input, corsHeaders, requestId } = ctx;
  const { email } = input;

  console.log(`[${requestId}] [INVITE-ADMIN] Processing invitation for ${email}`);

  // Check if user already exists
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

  // Generate secure invitation token (32 bytes = 64 hex chars)
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const invitationToken = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Set expiration to 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Store invitation in database
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
    throw new Error("Failed to create invitation");
  }

  // Create magic link
  const appUrl = config.supabase.url.replace(
    /^https:\/\/[^.]+\.supabase\.co/,
    req.headers.get("origin") || "http://localhost:5173"
  );
  const magicLink = `${appUrl}/admin/accept-invitation?token=${invitationToken}`;

  // Send invitation email
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

  console.log(`[${requestId}] [INVITE-ADMIN] Email sent successfully:`, emailResponse);

  // Log admin action
  await supabase.rpc("log_admin_action", {
    _action_type: "admin_invited",
    _new_value: { email, expires_at: expiresAt.toISOString() },
  });

  console.log(`[${requestId}] [INVITE-ADMIN] ✅ Success`);

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
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withValidation(InviteRequestSchema),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as Context));
