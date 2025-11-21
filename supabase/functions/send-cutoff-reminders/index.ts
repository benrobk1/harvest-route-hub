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
type CartWithProfile = { id: string; consumer_id: string; profiles: ProfileEmail | null };

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

  // OPTIMIZED: Find all consumers with pending orders for tomorrow
  // Added LIMIT to prevent OOM with 50k+ users
  const { data: pendingOrders } = await supabaseClient
    .from('orders')
    .select('consumer_id, profiles (email)')
    .eq('delivery_date', tomorrowDate)
    .eq('status', 'pending')
    .limit(10000); // Reasonable limit: max 10k pending orders per day

  // OPTIMIZED: Query carts with items in batches of distinct carts
  // Prevents OOM with 50k+ users and ensures we get actual cart count, not joined row count
  const cartsWithItems: CartWithProfile[] = [];
  const CART_BATCH_SIZE = 1000;
  let hasMore = true;
  let lastCartId: string | null = null;

  while (hasMore && cartsWithItems.length < 10000) {
    // Query distinct carts that have items, ordered by ID for stable pagination
    const query = supabaseClient
      .from('shopping_carts')
      .select(`
        id,
        consumer_id,
        profiles (email),
        cart_items!inner(id)
      `)
      .order('id', { ascending: true })
      .limit(CART_BATCH_SIZE);

    // Apply cursor pagination if not first batch
    if (lastCartId) {
      query.gt('id', lastCartId);
    }

    const { data: batch, error } = await query;

    if (error) {
      console.error(`[${ctx.requestId}] Error fetching cart batch:`, error);
      hasMore = false;
      break;
    }

    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    // Deduplicate carts in this batch (since inner join creates multiple rows per cart)
    const seenCartIds = new Set<string>();
    for (const row of batch) {
      const cart = row as CartWithProfile;
      if (!seenCartIds.has(cart.id)) {
        seenCartIds.add(cart.id);
        cartsWithItems.push(cart);
        
        // Stop if we've reached the target limit
        if (cartsWithItems.length >= 10000) {
          hasMore = false;
          break;
        }
      }
    }

    // Update cursor and check if we got a full batch
    if (hasMore) {
      lastCartId = (batch[batch.length - 1] as CartWithProfile).id;
      hasMore = batch.length === CART_BATCH_SIZE;
    }
  }

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

  for (const cart of cartsWithItems ?? []) {
    const profile = (cart as CartWithProfile).profiles;
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
