<<<<<<< HEAD
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
=======
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { AwardCreditsRequestSchema } from '../_shared/contracts/credits.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withAdminAuth,
  withRateLimit,
  withValidation,
  withErrorHandling,
  withMetrics,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
  type MetricsContext,
} from '../_shared/middleware/index.ts';

/**
 * AWARD CREDITS EDGE FUNCTION
 * 
 * Admin-only function to award credits to consumers.
 * Supports earned, bonus, and refund transaction types.
 * Full middleware: RequestId + Metrics + CORS + Auth + AdminAuth + RateLimit + Validation + ErrorHandling
 */

type AwardCreditsInput = {
  consumer_id: string;
  amount: number;
  description: string;
  transaction_type?: 'earned' | 'bonus' | 'refund';
  expires_in_days?: number;
};

type Context = RequestIdContext & CORSContext & AuthContext & ValidationContext<AwardCreditsInput> & MetricsContext;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, metrics, input } = ctx;
  
  const config = loadConfig();
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

  const { 
    consumer_id, 
    amount, 
    description, 
    transaction_type = 'earned',
    expires_in_days = 90 
  } = input;

  console.log(`[${requestId}] Awarding credits:`, { 
    consumer_id, 
    amount, 
    description, 
    transaction_type 
  });

    // Get current credit balance
    const { data: latestCredit } = await supabase
      .from('credits_ledger')
      .select('balance_after')
      .eq('consumer_id', consumer_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentBalance = latestCredit?.balance_after || 0;
    const newBalance = currentBalance + amount;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Insert credit transaction
    const { data: creditRecord, error: creditError } = await supabase
      .from('credits_ledger')
      .insert({
        consumer_id,
        transaction_type,
        amount,
        balance_after: newBalance,
        description,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (creditError) {
      console.error(`[${requestId}] ❌ Failed to award credits:`, creditError);
      throw new Error(`Credit award failed: ${creditError.message}`);
    }

    metrics.mark('credits_awarded');
    console.log(`[${requestId}] ✅ Credits awarded successfully:`, creditRecord.id);

    // Send notification to user (non-blocking)
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          event_type: 'credits_awarded',
          recipient_id: consumer_id,
          data: {
            amount,
            new_balance: newBalance,
            description,
            expires_at: expiresAt.toISOString()
          }
        }
      });
    } catch (notifError) {
      console.error(`[${requestId}] Notification failed (non-blocking):`, notifError);
    }

  return new Response(JSON.stringify({
    success: true,
    credit_id: creditRecord.id,
    amount_awarded: amount,
    new_balance: newBalance,
    expires_at: expiresAt.toISOString()
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withMetrics('award-credits'),
  withCORS,
  withAuth,
  withAdminAuth,
  withRateLimit(RATE_LIMITS.AWARD_CREDITS),
  withValidation(AwardCreditsRequestSchema),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
>>>>>>> main
