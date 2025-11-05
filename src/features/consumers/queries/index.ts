/**
 * CONSUMER QUERIES
 * Query factory pattern for consumer-related queries
 * 
 * @module features/consumers/queries
 * @description Centralized React Query keys for consumer profile, credits, subscriptions,
 * and shopping experience.
 * 
 * @example Usage
 * ```typescript
 * // Get consumer profile
 * const { data } = useQuery({ queryKey: consumerQueries.profile(userId) });
 * 
 * // Get credits balance
 * const { data } = useQuery({ queryKey: consumerQueries.credits(userId) });
 * 
 * // Get subscription status
 * const { data } = useQuery({ queryKey: consumerQueries.subscription(userId) });
 * ```
 */

export const consumerQueries = {
  /**
   * Base key for all consumer queries
   * @returns Base query key array for consumer data
   */
  all: () => ['consumers'] as const,
  
  /**
   * Consumer profile information
   * @param userId - Optional consumer user ID
   * @returns Query key for profile
   */
  profile: (userId?: string) => ['profile', userId] as const,
  
  /**
   * Consumer credits balance
   * @param userId - Consumer user ID
   * @returns Query key for credits
   */
  credits: (userId: string) => ['credits', userId] as const,
  
  /**
   * Credits breakdown (earned, spent, pending)
   * @param userId - Consumer user ID
   * @returns Query key for credits breakdown
   */
  creditsBreakdown: (userId: string) => ['credits-breakdown', userId] as const,
  
  /**
   * Subscription spending progress and tier
   * @param userId - Consumer user ID
   * @returns Query key for subscription data
   */
  subscription: (userId: string) => ['subscription-spending', userId] as const,
  
  /**
   * Consumer order history
   * @param userId - Consumer user ID
   * @returns Query key for consumer orders
   */
  orders: (userId: string) => ['consumer-orders', userId] as const,
  
  /**
   * Order success confirmation data
   * @param orderId - Order UUID
   * @returns Query key for order success details
   */
  orderSuccess: (orderId: string) => ['order-success', orderId] as const,
  
  /**
   * Market configuration for consumer's ZIP code
   * @param zipCode - Optional 5-digit ZIP code
   * @returns Query key for market config
   */
  marketConfig: (zipCode?: string) => ['market-config', zipCode] as const,
};
