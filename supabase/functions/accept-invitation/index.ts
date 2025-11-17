import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";

const AcceptInvitationRequestSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Full name is required").max(100, "Name too long"),
});

type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

interface AcceptInvitationContext
  extends RequestIdContext,
    CORSContext,
    SupabaseServiceRoleContext,
    ValidationContext<AcceptInvitationRequest> {}

const stack = createMiddlewareStack<AcceptInvitationContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withValidation(AcceptInvitationRequestSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, input } = ctx;
  const { token, password, fullName } = input;

  console.log(`[${requestId}] [ACCEPT-INVITATION] Processing token: ${token.substring(0, 8)}...`);

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
      },
    );
  }

  if (!consumedInvitations || consumedInvitations.length !== 1) {
    console.error(`[${requestId}] [ACCEPT-INVITATION] Token already used or invalid`);
    return new Response(
      JSON.stringify({ error: "Invalid or expired invitation" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
      },
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
      },
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
        },
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
    },
  );
});

serve((req) => {
  const initialContext: Partial<AcceptInvitationContext> = {};

  return handler(req, initialContext);
});
