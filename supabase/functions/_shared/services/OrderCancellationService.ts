import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * ORDER CANCELLATION SERVICE
 * Handles order cancellation with inventory restoration
 */
export class OrderCancellationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Validates if an order can be cancelled
   */
  async validateCancellation(orderId: string, userId: string) {
    // Get the order
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .select('id, consumer_id, status, total_amount, delivery_date')
      .eq('id', orderId)
      .eq('consumer_id', userId)
      .single();

    if (orderError || !order) {
      throw new Error('ORDER_NOT_FOUND');
    }

    // Check if order can be cancelled
    const allowedStatuses = ['pending', 'paid', 'confirmed'];
    if (!allowedStatuses.includes(order.status)) {
      throw new Error(`INVALID_STATUS: Cannot cancel order with status ${order.status}`);
    }

    // Check if within 24 hours of delivery
    const deliveryTime = new Date(order.delivery_date).getTime();
    const now = Date.now();
    const hoursUntilDelivery = (deliveryTime - now) / (1000 * 60 * 60);

    if (hoursUntilDelivery <= 24) {
      throw new Error('TOO_LATE_TO_CANCEL: Cannot cancel orders within 24 hours of delivery');
    }

    return order;
  }

  /**
   * Restores inventory for cancelled order
   */
  async restoreInventory(orderId: string): Promise<void> {
    const { data: orderItems } = await this.supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    if (!orderItems || orderItems.length === 0) {
      return;
    }

    // OPTIMIZED: Restore inventory in parallel (was N+1 with SELECT+UPDATE per item)
    // Critical for 50k+ orders - eliminates unnecessary SELECTs and parallelizes UPDATEs
    // Uses SQL increment to avoid race conditions
    const restorePromises = orderItems.map(item =>
      this.supabase.rpc('increment_product_quantity', {
        p_product_id: item.product_id,
        p_quantity_delta: item.quantity
      })
    );

    const results = await Promise.all(restorePromises);
    const failures = results.filter(r => r.error);

    if (failures.length > 0) {
      console.error('Inventory restore errors:', failures);
      throw new Error(`INVENTORY_RESTORE_FAILED: ${failures.length} items failed to restore`);
    }
  }

  /**
   * Deletes order and related records
   */
  async deleteOrder(orderId: string): Promise<void> {
    // Delete related records first
    await this.supabase.from('credits_ledger').delete().eq('order_id', orderId);
    await this.supabase.from('payment_intents').delete().eq('order_id', orderId);
    await this.supabase.from('transaction_fees').delete().eq('order_id', orderId);

    // Delete the order (order_items will cascade)
    const { error: deleteError } = await this.supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (deleteError) {
      throw new Error(`DELETION_FAILED: ${deleteError.message}`);
    }
  }

  /**
   * Cancels an order with full cleanup
   */
  async cancelOrder(orderId: string, userId: string): Promise<void> {
    // Validate
    await this.validateCancellation(orderId, userId);

    // Restore inventory
    await this.restoreInventory(orderId);

    // Delete order
    await this.deleteOrder(orderId);
  }
}
