/**
 * FEEDBACK QUERIES
 * Query factory pattern for feedback and ratings
 * 
 * @module features/consumers/queries
 * @description Centralized React Query keys for delivery ratings, farm ratings, and item ratings.
 * 
 * @example Usage
 * ```typescript
 * // Get driver ratings
 * const { data } = useQuery({ queryKey: feedbackQueries.driverRating(orderId) });
 * 
 * // Get farm ratings
 * const { data } = useQuery({ queryKey: feedbackQueries.farmRatings(farmProfileId) });
 * 
 * // Get item ratings
 * const { data } = useQuery({ queryKey: feedbackQueries.itemRatings(productId) });
 * ```
 */

export const feedbackQueries = {
  /**
   * Base key for all feedback queries
   */
  all: () => ['feedback'] as const,
  
  /**
   * Driver rating for a specific order
   */
  driverRating: (orderId: string) => 
    [...feedbackQueries.all(), 'driver', orderId] as const,
  
  /**
   * All farm ratings for a specific farm
   */
  farmRatings: (farmProfileId: string, filters?: Record<string, unknown>) =>
    [...feedbackQueries.all(), 'farm', farmProfileId, filters] as const,
  
  /**
   * Aggregate farm rating
   */
  farmRatingAggregate: (farmProfileId: string) => 
    [...feedbackQueries.all(), 'farm-aggregate', farmProfileId] as const,
  
  /**
   * All item ratings for a specific product
   */
  itemRatings: (productId: string, filters?: Record<string, unknown>) =>
    [...feedbackQueries.all(), 'item', productId, filters] as const,
  
  /**
   * Aggregate item rating
   */
  itemRatingAggregate: (productId: string) => 
    [...feedbackQueries.all(), 'item-aggregate', productId] as const,
  
  /**
   * Order feedback status (has user rated this order?)
   */
  orderFeedbackStatus: (orderId: string) => 
    [...feedbackQueries.all(), 'order-status', orderId] as const,
  
  /**
   * Consumer's submitted ratings
   */
  consumerRatings: (consumerId: string) => 
    [...feedbackQueries.all(), 'consumer', consumerId] as const,
};
