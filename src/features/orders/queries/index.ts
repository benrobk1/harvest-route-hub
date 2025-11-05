/**
 * ORDER QUERIES
 * Query factory pattern for order-related queries
 * Centralized query key management for TanStack Query
 */

export const orderQueries = {
  // Base key for all order queries
  all: () => ['orders'] as const,
  
  // User's orders
  byUser: (userId: string) => [...orderQueries.all(), 'user', userId] as const,
  
  // Active order (in progress)
  active: (userId: string) => [...orderQueries.all(), 'active', userId] as const,
  
  // Order details
  detail: (orderId: string) => [...orderQueries.all(), 'detail', orderId] as const,
  
  // Order history
  history: (userId: string, filters?: Record<string, any>) => 
    [...orderQueries.all(), 'history', userId, filters] as const,
};
