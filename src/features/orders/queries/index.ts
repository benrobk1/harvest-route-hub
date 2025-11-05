/**
 * ORDER QUERIES
 * Query factory pattern for order-related queries
 * 
 * @module features/orders/queries
 * @description Centralized React Query keys for order management, tracking, and history.
 * Supports active orders, order details, and filtered order history.
 * 
 * @example Usage
 * ```typescript
 * // Get user's orders
 * const { data } = useQuery({ queryKey: orderQueries.byUser(userId) });
 * 
 * // Get active order
 * const { data } = useQuery({ queryKey: orderQueries.active(userId) });
 * 
 * // Get order details
 * const { data } = useQuery({ queryKey: orderQueries.detail(orderId) });
 * ```
 */

export const orderQueries = {
  /**
   * Base key for all order queries
   * @returns Base query key array for orders
   */
  all: () => ['orders'] as const,
  
  /**
   * All orders for a specific user
   * @param userId - User ID
   * @returns Query key for user's orders
   */
  byUser: (userId: string) => [...orderQueries.all(), 'user', userId] as const,
  
  /**
   * Active order in progress (pending/confirmed status)
   * @param userId - User ID
   * @returns Query key for active order
   */
  active: (userId: string) => [...orderQueries.all(), 'active', userId] as const,
  
  /**
   * Individual order details with items
   * @param orderId - Order UUID
   * @returns Query key for order details
   */
  detail: (orderId: string) => [...orderQueries.all(), 'detail', orderId] as const,
  
  /**
   * Order history with optional filters
   * @param userId - User ID
   * @param filters - Optional filters (status, date range, etc.)
   * @returns Query key for order history
   */
  history: (userId: string, filters?: Record<string, any>) => 
    [...orderQueries.all(), 'history', userId, filters] as const,
};
