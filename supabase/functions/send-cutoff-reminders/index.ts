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
 * SEND CUTOFF REMINDERS EDGE FUNCTION
 * 
 * Scheduled job that sends reminders to consumers about order cutoff times.
 * Runs daily via pg_cron to notify users with pending orders or cart items.
 */

type Context = RequestIdContext & CORSContext & MetricsContext;

/**
 * Main handler with middleware composition
 */
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('reminder_job_started');
  
  const config = loadConfig();
  const supabaseClient = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
  );

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

  if (pendingOrders) {
    for (const order of pendingOrders) {
      const profile = order.profiles as any;
      if (profile?.email) {
        consumersToNotify.add(order.consumer_id);
        consumerEmails.set(order.consumer_id, profile.email);
      }
    }
  }

  if (cartsWithItems) {
    for (const item of cartsWithItems) {
      const cart = item.shopping_carts as any;
      const profile = cart?.profiles as any;
      if (cart?.consumer_id && profile?.email) {
        consumersToNotify.add(cart.consumer_id);
        consumerEmails.set(cart.consumer_id, profile.email);
      }
    }
  }

  console.log(`[${ctx.requestId}] Found ${consumersToNotify.size} consumers to notify`);
  ctx.metrics.mark('consumers_identified');

  const results = {
    success: true,
    reminders_sent: 0,
    errors: [] as any[]
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
    } catch (error: any) {
      console.error(`[${ctx.requestId}] Failed to send reminder to ${consumerId}:`, error);
      results.errors.push({
        consumer_id: consumerId,
        error: error.message
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
  withMetrics('send-cutoff-reminders'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
