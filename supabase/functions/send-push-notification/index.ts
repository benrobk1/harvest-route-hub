import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { checkRateLimit } from "../_shared/rateLimiter.ts";
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
import { maskEmail, truncateMessage } from "../_shared/utils.ts";

const SendPushNotificationSchema = z.object({
  consumerId: z.string().min(1, { message: "consumerId is required" }),
  message: z.string().min(1, { message: "message is required" }),
  eta: z.string().optional(),
  stopsRemaining: z.number().int().nonnegative().optional(),
});

type SendPushNotificationInput = z.infer<typeof SendPushNotificationSchema>;

interface SendPushNotificationContext
  extends RequestIdContext,
    CORSContext,
    ValidationContext<SendPushNotificationInput>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<SendPushNotificationContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withValidation(SendPushNotificationSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, input } = ctx;
  const { consumerId, message, eta, stopsRemaining } = input;

  const rateCheck = await checkRateLimit(supabase, consumerId, {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    keyPrefix: "push-notification",
  });

  if (!rateCheck.allowed) {
    console.warn(
      `[${requestId}] [SEND-PUSH-NOTIFICATION] Rate limit exceeded`,
      { consumerId },
    );

    return new Response(
      JSON.stringify({
        error: "TOO_MANY_REQUESTS",
        message: "Notification rate limit exceeded.",
        retryAfter: rateCheck.retryAfter,
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("push_subscription, email, full_name")
    .eq("id", consumerId)
    .single();

  if (profileError || !profile) {
    console.error(
      `[${requestId}] [SEND-PUSH-NOTIFICATION] Consumer not found`,
      profileError,
    );

    return new Response(
      JSON.stringify({ error: "Consumer not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!profile.push_subscription?.enabled) {
    return new Response(
      JSON.stringify({ error: "Notifications not enabled for this user" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  console.log(
    `[${requestId}] [SEND-PUSH-NOTIFICATION] Notification placeholder`,
    {
      consumerId,
      emailMasked: profile.email ? maskEmail(profile.email) : undefined,
      messagePreview: truncateMessage(message, 20),
      eta,
      stopsRemaining,
    },
  );

  const updatedSubscription = {
    ...profile.push_subscription,
    last_notification: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ push_subscription: updatedSubscription })
    .eq("id", consumerId);

  if (updateError) {
    console.error(
      `[${requestId}] [SEND-PUSH-NOTIFICATION] Failed to log notification`,
      updateError,
    );
    throw updateError;
  }

  return new Response(
    JSON.stringify({
      success: true,
      message:
        "Notification logged (push implementation requires VAPID setup)",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

serve((req) => {
  const initialContext: Partial<SendPushNotificationContext> = {};

  return handler(req, initialContext);
});
