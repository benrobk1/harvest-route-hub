import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import {
  createMiddlewareStack,
  withAdminAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { AdminAuthContext } from "../_shared/middleware/withAdminAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const AwardCreditsSchema = z.object({
  consumer_id: z.string().uuid({ message: "Invalid consumer ID format" }),
  amount: z
    .number()
    .positive({ message: "Amount must be positive" })
    .max(1000, { message: "Amount cannot exceed $1000" }),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .max(500, { message: "Description must be less than 500 characters" }),
  transaction_type: z.enum(["earned", "bonus", "refund"]).optional(),
  expires_in_days: z
    .number()
    .int({ message: "Expiration must be an integer" })
    .positive({ message: "Expiration must be positive" })
    .max(365, { message: "Expiration cannot exceed 365 days" })
    .optional(),
});

type AwardCreditsInput = z.infer<typeof AwardCreditsSchema>;

interface AwardCreditsContext
  extends RequestIdContext,
    CORSContext,
    AdminAuthContext,
    ValidationContext<AwardCreditsInput>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<AwardCreditsContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withValidation(AwardCreditsSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, user, input } = ctx;

  const {
    consumer_id,
    amount,
    description,
    transaction_type = "earned",
    expires_in_days = 90,
  } = input;

  console.log(
    `[${requestId}] [AWARD-CREDITS] Admin ${user.id} awarding credits`,
    { consumer_id, amount, transaction_type },
  );

  const { data: latestCredit, error: latestCreditError } = await supabase
    .from("credits_ledger")
    .select("balance_after")
    .eq("consumer_id", consumer_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestCreditError) {
    console.error(
      `[${requestId}] [AWARD-CREDITS] Failed to load current balance`,
      latestCreditError,
    );
    throw latestCreditError;
  }

  const currentBalance = latestCredit?.balance_after ?? 0;
  const newBalance = currentBalance + amount;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_in_days);

  const { data: creditRecord, error: creditError } = await supabase
    .from("credits_ledger")
    .insert({
      consumer_id,
      transaction_type,
      amount,
      balance_after: newBalance,
      description,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (creditError) {
    console.error(
      `[${requestId}] [AWARD-CREDITS] Failed to insert credit record`,
      creditError,
    );
    throw creditError;
  }

  console.log(
    `[${requestId}] [AWARD-CREDITS] Credits awarded successfully`,
    { creditId: creditRecord.id, newBalance },
  );

  try {
    await supabase.functions.invoke("send-notification", {
      body: {
        event_type: "credits_awarded",
        recipient_id: consumer_id,
        data: {
          amount,
          new_balance: newBalance,
          description,
          expires_at: expiresAt.toISOString(),
        },
      },
    });
  } catch (notifError) {
    console.error(
      `[${requestId}] [AWARD-CREDITS] Notification failed (non-blocking)`,
      notifError,
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      credit_id: creditRecord.id,
      amount_awarded: amount,
      new_balance: newBalance,
      expires_at: expiresAt.toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

serve((req) => {
  const initialContext: Partial<AwardCreditsContext> = {};

  return handler(req, initialContext);
});
