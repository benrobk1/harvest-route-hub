import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
<<<<<<< HEAD
import {
  createMiddlewareStack,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
} from "../_shared/middleware/index.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";
=======
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { loadConfig } from '../_shared/config.ts';
import { 
  withRequestId, 
  withCORS, 
  withValidation,
  withErrorHandling, 
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type ValidationContext
} from '../_shared/middleware/index.ts';

/**
 * ACCEPT INVITATION EDGE FUNCTION
 * 
 * Public endpoint for accepting admin invitations and creating accounts.
 * Uses middleware pattern with validation (no authentication required).
 */
>>>>>>> main

// Validation schema
const AcceptInvitationRequestSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required").max(100, "Name too long"),
});

<<<<<<< HEAD
interface AcceptInvitationContext
  extends RequestIdContext,
    CORSContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<AcceptInvitationContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
]);

const handler = stack(async (req, ctx) => {
  const { supabase, corsHeaders, requestId } = ctx;

  let payload: AcceptInvitationRequest;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { token, password, fullName } = payload as Partial<AcceptInvitationRequest>;

  if (typeof token !== "string" || typeof password !== "string" || typeof fullName !== "string") {
    return new Response(
      JSON.stringify({ error: "Missing or invalid required fields" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (password.length < 6) {
    return new Response(
      JSON.stringify({ error: "Password must be at least 6 characters" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`[${requestId}] [ACCEPT-INVITATION] Processing token: ${token.substring(0, 8)}...`);

  // Atomically consume the token: mark as used with WHERE used_at IS NULL
  // This prevents race conditions and ensures token can only be used once
  const { data: consumedInvitations, error: consumeError } = await supabase
    .from("admin_invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("invitation_token", token)
    .is("used_at", null)
    .gte("expires_at", new Date().toISOString())
    .select("*");

  if (consumeError) {
    console.error(`[${requestId}] [ACCEPT-INVITATION] Error consuming token:`, consumeError);
    return new Response(
      JSON.stringify({ error: "Invalid or expired invitation" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Verify exactly one row was affected (token exists, unused, and not expired)
  if (!consumedInvitations || consumedInvitations.length !== 1) {
    console.error(`[${requestId}] [ACCEPT-INVITATION] Token already used or invalid`);
    return new Response(
      JSON.stringify({ error: "Invalid or expired invitation" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const invitation = consumedInvitations[0];
  console.log(`[${requestId}] [ACCEPT-INVITATION] Token consumed, creating user for ${invitation.email}`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError || !authData.user) {
    console.error(`[${requestId}] [ACCEPT-INVITATION] Error creating user:`, authError);
    return new Response(
      JSON.stringify({ error: authError?.message || "Failed to create user account" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`[${requestId}] [ACCEPT-INVITATION] User created: ${authData.user.id}`);

  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({
      user_id: authData.user.id,
      role: "admin",
    });

  if (roleError) {
    console.error(`[${requestId}] [ACCEPT-INVITATION] Error assigning role:`, roleError);
    await supabase.auth.admin.deleteUser(authData.user.id);
    return new Response(
      JSON.stringify({ error: "Failed to assign admin role" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`[${requestId}] [ACCEPT-INVITATION] Admin role assigned`);

  if (invitation.invited_by) {
    const { error: logError } = await supabase.rpc("log_admin_action", {
      _action_type: "admin_invitation_accepted",
      _target_user_id: authData.user.id,
      _new_value: { email: invitation.email, full_name: fullName },
    });

    if (logError) {
      console.error(
        `[${requestId}] [ACCEPT-INVITATION] Failed to log admin action`,
        {
          error: logError,
          invited_by: invitation.invited_by,
          target_user_id: authData.user.id,
          email: invitation.email,
          full_name: fullName,
        }
      );
    }
  }

  console.log(`[${requestId}] [ACCEPT-INVITATION] Success for ${invitation.email}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Account created successfully. You can now log in.",
      email: invitation.email,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});

serve((req) => {
  const initialContext: Partial<AcceptInvitationContext> = {};

  return handler(req, initialContext);
});
=======
type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

type Context = RequestIdContext & CORSContext & ValidationContext<AcceptInvitationRequest>;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { token, password, fullName } = ctx.input;
  
  console.log(`[${ctx.requestId}] [ACCEPT-INVITATION] Processing token: ${token.substring(0, 8)}...`);

  const config = loadConfig();
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // Fetch and validate invitation
    const { data: invitation, error: invitationError } = await supabase
      .from("admin_invitations")
      .select("*")
      .eq("invitation_token", token)
      .is("used_at", null)
      .single();

  if (invitationError || !invitation) {
    console.error(`[${ctx.requestId}] [ACCEPT-INVITATION] Invalid token:`, invitationError);
    return new Response(
      JSON.stringify({ error: "Invalid or expired invitation" }),
      {
        status: 400,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    console.error(`[${ctx.requestId}] [ACCEPT-INVITATION] Token expired`);
    return new Response(
      JSON.stringify({ error: "This invitation has expired" }),
      {
        status: 400,
        headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  console.log(`[${ctx.requestId}] [ACCEPT-INVITATION] Creating user for ${invitation.email}`);

  // Create user account
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: invitation.email,
    password: password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError || !authData.user) {
    console.error(`[${ctx.requestId}] [ACCEPT-INVITATION] Error creating user:`, authError);
    throw new Error(authError?.message || "Failed to create user account");
  }

  console.log(`[${ctx.requestId}] [ACCEPT-INVITATION] User created: ${authData.user.id}`);

  // Assign admin role
  const { error: roleError } = await supabase
    .from("user_roles")
    .insert({
      user_id: authData.user.id,
      role: "admin",
    });

  if (roleError) {
    console.error(`[${ctx.requestId}] [ACCEPT-INVITATION] Error assigning role:`, roleError);
    // Clean up - delete the user if role assignment fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error("Failed to assign admin role");
  }

  console.log(`[${ctx.requestId}] [ACCEPT-INVITATION] Admin role assigned`);

  // Mark invitation as used
  await supabase
    .from("admin_invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("invitation_token", token);

  // Log admin action (attributed to the inviter)
  if (invitation.invited_by) {
    await supabase.rpc("log_admin_action", {
      _action_type: "admin_invitation_accepted",
      _target_user_id: authData.user.id,
      _new_value: { email: invitation.email, full_name: fullName },
    });
  }

  console.log(`[${ctx.requestId}] [ACCEPT-INVITATION] ✅ Success for ${invitation.email}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Account created successfully. You can now log in.",
      email: invitation.email,
    }),
    {
      status: 200,
      headers: { ...ctx.corsHeaders, "Content-Type": "application/json" },
    }
  );
};

// Compose middleware stack (public endpoint, no auth needed)
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withValidation(AcceptInvitationRequestSchema),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
>>>>>>> main
