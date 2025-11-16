import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadConfig } from '../_shared/config.ts';
import { 
  withRequestId, 
  withCORS, 
  withErrorHandling, 
  withMetrics,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type MetricsContext
} from '../_shared/middleware/index.ts';

/**
 * SEND TRIAL REMINDERS EDGE FUNCTION
 * 
 * Scheduled job that sends reminders to users with expiring trials.
 * Runs daily via pg_cron to notify users 7 days before trial ends.
 */

type Context = RequestIdContext & CORSContext & MetricsContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('trial_check_started');
  
  const config = loadConfig();
  const supabaseClient = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
  );

  console.log(`[${ctx.requestId}] Checking for expiring trials...`);

  // Find subscriptions with trials ending in 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  const eightDaysFromNow = new Date();
  eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

  const { data: expiringTrials, error } = await supabaseClient
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
    console.error(`[${ctx.requestId}] Error fetching expiring trials:`, error);
    throw error;
  }

  console.log(`[${ctx.requestId}] Found ${expiringTrials?.length || 0} expiring trials`);
  ctx.metrics.mark('trials_fetched');

  const results = {
    success: true,
    reminders_sent: 0,
    errors: [] as any[]
  };

  // Send reminder emails
  for (const trial of expiringTrials || []) {
    try {
      const trialEndDate = new Date(trial.trial_end);
      
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          event_type: 'trial_ending',
          recipient_id: trial.consumer_id,
          data: {
            trial_end_date: trialEndDate.toLocaleDateString(),
            days_remaining: 7
          }
        }
      });

      console.log(`[${ctx.requestId}] Sent trial reminder to user ${trial.consumer_id}`);
      results.reminders_sent++;
      ctx.metrics.mark('reminder_sent');
    } catch (notifError: any) {
      console.error(`[${ctx.requestId}] Failed to send reminder for ${trial.consumer_id}:`, notifError);
      results.errors.push({
        consumer_id: trial.consumer_id,
        error: notifError.message
      });
      ctx.metrics.mark('reminder_failed');
    }
  }

  console.log(`[${ctx.requestId}] ✅ Trial reminder job complete:`, results);
  ctx.metrics.mark('job_complete');

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
  });
};

// Compose middleware stack (public endpoint for cron)
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withMetrics('send-trial-reminders'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
