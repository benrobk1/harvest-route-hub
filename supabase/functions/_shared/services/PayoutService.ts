import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import Stripe from 'https://esm.sh/stripe@18.5.0';

/**
 * PAYOUT SERVICE
 * Handles payout processing to Stripe Connect accounts
 */

export interface PayoutResult {
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    payoutId: string;
    error: string;
    code?: string;
  }>;
}

export class PayoutService {
  constructor(
    private supabase: SupabaseClient,
    private stripe: Stripe
  ) {}

  async processPendingPayouts(): Promise<PayoutResult> {
    const requestId = crypto.randomUUID();
    console.log(`[${requestId}] [PAYOUTS] Starting payout processing...`);

    // Fetch pending payouts
    const { data: pendingPayouts, error } = await this.supabase
      .from('payouts')
      .select(`
        *,
        orders (
          id,
          status,
          delivery_date
        )
      `)
      .eq('status', 'pending')
      .not('stripe_connect_account_id', 'is', null)
      .in('recipient_type', ['farmer', 'driver']);

    if (error) {
      console.error(`[${requestId}] [PAYOUTS] ❌ Database error:`, error);
      throw error;
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      console.log(`[${requestId}] [PAYOUTS] No pending payouts to process`);
      return { successful: 0, failed: 0, skipped: 0, errors: [] };
    }

    console.log(`[${requestId}] [PAYOUTS] Found ${pendingPayouts.length} pending payouts`);

    const result: PayoutResult = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Process each payout
    for (const payout of pendingPayouts) {
      try {
        const order = payout.orders as any;

        // Only process payouts for delivered orders
        if (order.status !== 'delivered') {
          console.log(`[${requestId}] [PAYOUTS] Skipping payout ${payout.id} - order ${order.id} not delivered (status: ${order.status})`);
          result.skipped++;
          continue;
        }

        console.log(`[${requestId}] [PAYOUTS] Processing payout ${payout.id}: $${payout.amount} to ${payout.recipient_type} (${payout.stripe_connect_account_id})`);

        // Verify Connect account
        const account = await this.stripe.accounts.retrieve(payout.stripe_connect_account_id);

        if (!account.payouts_enabled) {
          console.warn(`[${requestId}] [PAYOUTS] ⚠️  Account ${payout.stripe_connect_account_id} not enabled for payouts`);
          result.failed++;
          result.errors.push({
            payoutId: payout.id,
            error: 'PAYOUTS_NOT_ENABLED',
            code: account.id
          });
          continue;
        }

        // Create Stripe transfer
        const transfer = await this.stripe.transfers.create({
          amount: Math.round(payout.amount * 100), // Convert to cents
          currency: 'usd',
          destination: payout.stripe_connect_account_id,
          description: payout.description,
          metadata: {
            payout_id: payout.id,
            order_id: payout.order_id,
            recipient_id: payout.recipient_id,
            recipient_type: payout.recipient_type
          }
        });

        console.log(`[${requestId}] [PAYOUTS] Transfer created: ${transfer.id}`);

        // Update payout record
        await this.supabase
          .from('payouts')
          .update({
            status: 'completed',
            stripe_transfer_id: transfer.id,
            completed_at: new Date().toISOString()
          })
          .eq('id', payout.id);

        result.successful++;
        console.log(`[${requestId}] [PAYOUTS] ✅ Payout ${payout.id} completed successfully`);

      } catch (error: any) {
        console.error(`[${requestId}] [PAYOUTS] ❌ Failed to process payout ${payout.id}:`, error.message);

        result.failed++;
        result.errors.push({
          payoutId: payout.id,
          error: error.message,
          code: error.code
        });

        // Mark payout as failed
        await this.supabase
          .from('payouts')
          .update({
            status: 'failed',
            description: `${payout.description} - Failed: ${error.message}`
          })
          .eq('id', payout.id);
      }
    }

    console.log(`[${requestId}] [PAYOUTS] Processing complete: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  }
}
