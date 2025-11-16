import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

interface SendCutoffRemindersContext
  extends RequestIdContext,
    CORSContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<SendCutoffRemindersContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId } = ctx;

  console.log(`[${requestId}] [SEND-CUTOFF-REMINDERS] Starting reminder job`);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  const { data: pendingOrders, error: pendingOrdersError } = await supabase
    .from("orders")
    .select("consumer_id, profiles(email)")
    .eq("delivery_date", tomorrowDate)
    .eq("status", "pending");

  if (pendingOrdersError) {
    console.error(
      `[${requestId}] [SEND-CUTOFF-REMINDERS] Failed to load pending orders`,
      pendingOrdersError,
    );
    throw pendingOrdersError;
  }

  // Filter carts to only those updated in the last 7 days to avoid unbounded table scan
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 7);
  const recentDateISO = recentDate.toISOString();

  const { data: cartsWithItems, error: cartsError } = await supabase
    .from("cart_items")
    .select(
      `cart_id, shopping_carts ( consumer_id, profiles (email) )`,
    )
    .gte("shopping_carts.updated_at", recentDateISO);

  if (cartsError) {
    console.error(
      `[${requestId}] [SEND-CUTOFF-REMINDERS] Failed to load carts`,
      cartsError,
    );
    throw cartsError;
  }

  const consumersToNotify = new Set<string>();
  const consumerEmails = new Map<string, string>();

  for (const order of pendingOrders ?? []) {
    const profile = order.profiles as { email?: string } | null;
    if (profile?.email) {
      consumersToNotify.add(order.consumer_id);
      consumerEmails.set(order.consumer_id, profile.email);
    }
  }

  for (const item of cartsWithItems ?? []) {
    const cart = item.shopping_carts as { consumer_id?: string; profiles?: { email?: string } | null } | null;
    const consumerId = cart?.consumer_id;
    const email = cart?.profiles?.email;

    if (consumerId && email) {
      consumersToNotify.add(consumerId);
      consumerEmails.set(consumerId, email);
    }
  }

  console.log(
    `[${requestId}] [SEND-CUTOFF-REMINDERS] Notifying consumers`,
    { count: consumersToNotify.size },
  );

  const results = {
    success: true,
    reminders_sent: 0,
    errors: [] as { consumer_id: string; error: string }[],
  };

  for (const consumerId of consumersToNotify) {
    try {
      const { error: notifyError } = await supabase.functions.invoke(
        "send-notification",
        {
          body: {
            event_type: "cutoff_reminder",
            recipient_id: consumerId,
            recipient_email: consumerEmails.get(consumerId),
            data: {
              delivery_date: tomorrowDate,
            },
          },
        },
      );

      if (notifyError) {
        throw notifyError;
      }

      results.reminders_sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[${requestId}] [SEND-CUTOFF-REMINDERS] Failed to notify consumer`,
        { consumerId, message },
      );

      results.errors.push({ consumer_id: consumerId, error: message });
    }
  }

  console.log(
    `[${requestId}] [SEND-CUTOFF-REMINDERS] Completed reminder job`,
    { remindersSent: results.reminders_sent, errors: results.errors.length },
  );

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

serve((req) => {
  const initialContext: Partial<SendCutoffRemindersContext> = {};

  return handler(req, initialContext);
});
