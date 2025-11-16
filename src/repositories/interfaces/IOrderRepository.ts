/**
 * ORDER REPOSITORY INTERFACE
 * Defines the contract for order data access operations
 */

import type { OrderWithDetails } from '@/features/orders/types';

export interface IOrderRepository {
  /**
   * Get active order for a consumer (confirmed, in_transit, or out_for_delivery)
   */
  getActiveOrder(consumerId: string): Promise<OrderWithDetails | null>;

  /**
   * Subscribe to order updates for a consumer
   */
  subscribeToOrderUpdates(consumerId: string, callback: () => void): () => void;

  /**
   * Get order by ID
   */
  getOrderById(orderId: string): Promise<OrderWithDetails | null>;

  /**
   * Get all orders for a consumer
   */
  getConsumerOrders(consumerId: string): Promise<any[]>;
}
