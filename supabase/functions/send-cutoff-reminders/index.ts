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
type CartWithProfile = { consumer_id: string; profiles: ProfileEmail | null };

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

  // Combine and deduplicate consumers
  const consumersToNotify = new Set<string>();
  const consumerEmails = new Map<string, string>();

  // OPTIMIZED: Paginate through all pending orders for tomorrow
  // Process in batches to prevent OOM with 50k+ users
  const PAGE_SIZE = 1000;
  let pendingOrdersPage = 0;
  let hasMoreOrders = true;

  while (hasMoreOrders) {
    const { data: pendingOrders } = await supabaseClient
      .from('orders')
      .select('consumer_id, profiles (email)')
      .eq('delivery_date', tomorrowDate)
      .eq('status', 'pending')
      .range(pendingOrdersPage * PAGE_SIZE, (pendingOrdersPage + 1) * PAGE_SIZE - 1);

    if (!pendingOrders || pendingOrders.length === 0) {
      hasMoreOrders = false;
    } else {
      for (const order of pendingOrders) {
        const profile = (order as OrderWithProfile).profiles;
        if (profile?.email) {
          consumersToNotify.add(order.consumer_id);
          consumerEmails.set(order.consumer_id, profile.email);
        }
      }

      hasMoreOrders = pendingOrders.length === PAGE_SIZE;
      pendingOrdersPage++;
    }
  }

  console.log(`[${ctx.requestId}] Processed ${pendingOrdersPage} pages of pending orders`);

  // OPTIMIZED: Paginate through carts with items to prevent OOM
  // Process in batches to handle 50k+ users
  let cartsPage = 0;
  let hasMoreCarts = true;

  while (hasMoreCarts) {
    const { data: cartsWithItems } = await supabaseClient
      .from('shopping_carts')
      .select(`
        consumer_id,
        profiles (email),
        cart_items!inner(id)
      `)
      .range(cartsPage * PAGE_SIZE, (cartsPage + 1) * PAGE_SIZE - 1);

    if (!cartsWithItems || cartsWithItems.length === 0) {
      hasMoreCarts = false;
    } else {
      for (const cart of cartsWithItems) {
        const profile = (cart as CartWithProfile).profiles;
        if (cart?.consumer_id && profile?.email) {
          consumersToNotify.add(cart.consumer_id);
          consumerEmails.set(cart.consumer_id, profile.email);
        }
      }

      hasMoreCarts = cartsWithItems.length === PAGE_SIZE;
      cartsPage++;
    }
  }

  console.log(`[${ctx.requestId}] Processed ${cartsPage} pages of active carts`);
  ctx.metrics.mark('consumers_fetched');

  console.log(`[${ctx.requestId}] Found ${consumersToNotify.size} consumers to notify`);
  ctx.metrics.mark('consumers_identified');

  const results: ReminderResults = {
    success: true,
    reminders_sent: 0,
    errors: []
  };

  // OPTIMIZED: Send reminders in parallel batches (was sequential)
  // Critical for 50k+ users - reduces from 13+ hours to minutes
  const BATCH_SIZE = 100; // Process 100 notifications concurrently
  const consumerArray = Array.from(consumersToNotify);

  for (let i = 0; i < consumerArray.length; i += BATCH_SIZE) {
    const batch = consumerArray.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (consumerId) => {
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

        ctx.metrics.mark('reminder_sent');
        return { success: true, consumerId };
      } catch (error: unknown) {
        console.error(`[${ctx.requestId}] Failed to send reminder to ${consumerId}:`, error);
        ctx.metrics.mark('reminder_failed');
        return {
          success: false,
          consumerId,
          error: getErrorMessage(error)
        };
      }
    });

    // Wait for batch to complete before starting next batch
    const batchResults = await Promise.all(batchPromises);

    // Update results
    batchResults.forEach(result => {
      if (result.success) {
        results.reminders_sent++;
      } else {
        results.errors.push({
          consumer_id: result.consumerId,
          error: result.error!
        });
      }
    });

    console.log(`[${ctx.requestId}] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batchResults.filter(r => r.success).length}/${batch.length} sent`);
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
