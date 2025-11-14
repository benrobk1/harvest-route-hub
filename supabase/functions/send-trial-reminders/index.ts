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

interface SendTrialRemindersContext
  extends RequestIdContext,
    CORSContext,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<SendTrialRemindersContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId } = ctx;

  console.log(`[${requestId}] [SEND-TRIAL-REMINDERS] Checking for expiring trials...`);

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const eightDaysFromNow = new Date();
  eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

  const { data: expiringTrials, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      consumer_id,
      trial_end,
      profiles!inner(email, full_name)
    `)
    .eq('status', 'trialing')
    .gte('trial_end', sevenDaysFromNow.toISOString())
    .lt('trial_end', eightDaysFromNow.toISOString());

  if (error) {
    console.error(`[${requestId}] [SEND-TRIAL-REMINDERS] Error fetching expiring trials:`, error);
    throw error;
  }

  console.log(`[${requestId}] [SEND-TRIAL-REMINDERS] Found ${expiringTrials?.length ?? 0} expiring trials`);

  for (const trial of expiringTrials ?? []) {
    try {
      const trialEndDate = new Date(trial.trial_end);

      await supabase.functions.invoke('send-notification', {
        body: {
          event_type: 'trial_ending',
          recipient_id: trial.consumer_id,
          data: {
            trial_end_date: trialEndDate.toLocaleDateString(),
            days_remaining: 7,
          },
        },
      });

      console.log(`[${requestId}] [SEND-TRIAL-REMINDERS] Sent reminder to user ${trial.consumer_id}`);
    } catch (notifError) {
      console.error(`[${requestId}] [SEND-TRIAL-REMINDERS] Failed to send reminder for user ${trial.consumer_id}:`, notifError);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      reminders_sent: expiringTrials?.length ?? 0,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});

serve((req) => {
  const initialContext: Partial<SendTrialRemindersContext> = {};

  return handler(req, initialContext);
});