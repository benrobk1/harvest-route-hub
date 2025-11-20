import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  withRequestId,
  withCORS,
  withErrorHandling,
  withMetrics,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type MetricsContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';
import { getErrorMessage } from '../_shared/utils.ts';

/**
 * SEND CUTOFF REMINDERS EDGE FUNCTION
 * 
 * Scheduled job that sends reminders to consumers about order cutoff times.
 * Runs daily via pg_cron to notify users with pending orders or cart items.
 */

type Context = RequestIdContext & CORSContext & MetricsContext & SupabaseServiceRoleContext;

type ProfileEmail = { email: string | null };
type OrderWithProfile = { consumer_id: string; profiles: ProfileEmail | null };
type CartWithProfile = {
  shopping_carts: { consumer_id: string; profiles: ProfileEmail | null } | null;
};

type ReminderError = { consumer_id: string; error: string };
type ReminderResults = {
  success: true;
  reminders_sent: number;
  errors: ReminderError[];
};

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('reminder_job_started');
  
  const { supabase: supabaseClient } = ctx;

  console.log(`[${ctx.requestId}] Starting cutoff reminder job...`);

  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  ctx.metrics.mark('date_calculated');

  // Find all consumers with pending orders for tomorrow
  const { data: pendingOrders } = await supabaseClient
    .from('orders')
    .select('consumer_id, profiles (email)')
    .eq('delivery_date', tomorrowDate)
    .eq('status', 'pending');

  // Find consumers with items in cart (who haven't checked out yet)
  const { data: cartsWithItems } = await supabaseClient
    .from('cart_items')
    .select(`
      cart_id,
      shopping_carts (
        consumer_id,
        profiles (email)
      )
    `);

  ctx.metrics.mark('consumers_fetched');

  // Combine and deduplicate consumers
  const consumersToNotify = new Set<string>();
  const consumerEmails = new Map<string, string>();

  for (const order of pendingOrders ?? []) {
    const profile = (order as OrderWithProfile).profiles;
    if (profile?.email) {
      consumersToNotify.add(order.consumer_id);
      consumerEmails.set(order.consumer_id, profile.email);
    }
  }

  for (const item of cartsWithItems ?? []) {
    const cart = (item as CartWithProfile).shopping_carts;
    const profile = cart?.profiles;
    if (cart?.consumer_id && profile?.email) {
      consumersToNotify.add(cart.consumer_id);
      consumerEmails.set(cart.consumer_id, profile.email);
    }
  }

  console.log(`[${ctx.requestId}] Found ${consumersToNotify.size} consumers to notify`);
  ctx.metrics.mark('consumers_identified');

  const results: ReminderResults = {
    success: true,
    reminders_sent: 0,
    errors: []
  };

  // Send reminder to each consumer
  for (const consumerId of consumersToNotify) {
    try {
      await supabaseClient.functions.invoke('send-notification', {
        body: {
          event_type: 'cutoff_reminder',
          recipient_id: consumerId,
          recipient_email: consumerEmails.get(consumerId),
          data: {
            delivery_date: tomorrowDate
          }
        }
      });

      results.reminders_sent++;
      ctx.metrics.mark('reminder_sent');
    } catch (error: unknown) {
      console.error(`[${ctx.requestId}] Failed to send reminder to ${consumerId}:`, error);
      results.errors.push({
        consumer_id: consumerId,
        error: getErrorMessage(error)
      });
      ctx.metrics.mark('reminder_failed');
    }
  }

  console.log(`[${ctx.requestId}] ✅ Cutoff reminder job complete:`, results);
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
  withSupabaseServiceRole,
  withMetrics('send-cutoff-reminders'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as Context));
