/**
 * DRIVER QUERIES
 * Query factory pattern for driver-related queries
 * 
 * @module features/drivers/queries
 * @description Centralized React Query keys for driver features including routes,
 * deliveries, earnings, and batch management.
 * 
 * @example Usage
 * ```typescript
 * // Get available routes
 * const { data } = useQuery({ queryKey: driverQueries.availableRoutes() });
 * 
 * // Get active batch
 * const { data } = useQuery({ queryKey: driverQueries.activeBatch(userId) });
 * 
 * // Get route stops (addresses visible after box scan)
 * const { data } = useQuery({ queryKey: driverQueries.routeStops(batchId) });
 * ```
 */

export const driverQueries = {
  /**
   * Base key for all driver queries
   * @returns Base query key array for drivers
   */
  all: () => ['drivers'] as const,
  
  /**
   * Driver profile information
   * @param userId - Optional driver user ID
   * @returns Query key for driver profile
   */
  profile: (userId?: string) => [...driverQueries.all(), 'profile', userId] as const,
  
  /**
   * Driver rating and review data
   * @param driverId - Driver profile ID
   * @returns Query key for driver rating
   */
  rating: (driverId: string) => [...driverQueries.all(), 'rating', driverId] as const,
  
  /**
   * Available delivery routes/batches for claiming
   * Only shows unclaimed batches for upcoming delivery dates
   * @returns Query key for available routes
   */
  availableRoutes: () => [...driverQueries.all(), 'available-routes'] as const,
  
  /**
   * Active route for driver (claimed batch)
   * @param userId - Driver user ID
   * @returns Query key for active route
   */
  activeRoute: (userId: string) => [...driverQueries.all(), 'active-route', userId] as const,
  
  /**
   * Active batch details for driver
   * @param userId - Driver user ID
   * @returns Query key for active batch
   */
  activeBatch: (userId: string) => [...driverQueries.all(), 'active-batch', userId] as const,
  
  /**
   * Route stops/deliveries for a batch
   * 
   * **Address Privacy**: Full addresses only visible after driver scans box code
   * at collection point (when address_visible_at is set).
   * 
   * @param batchId - Delivery batch ID
   * @returns Query key for route stops
   * @see {@link https://github.com/yourusername/blue-harvests/blob/main/ARCHITECTURE.md#operational-safety-driver-address-privacy}
   */
  routeStops: (batchId: string) => [...driverQueries.all(), 'route-stops', batchId] as const,
  
  /**
   * Delivery batch full details
   * @param batchId - Delivery batch ID
   * @returns Query key for batch details
   */
  deliveryBatch: (batchId: string) => [...driverQueries.all(), 'delivery-batch', batchId] as const,
  
  /**
   * Driver earnings summary
   * @param userId - Driver user ID
   * @returns Query key for earnings
   */
  earnings: (userId: string) => [...driverQueries.all(), 'earnings', userId] as const,
  
  /**
   * Driver dashboard statistics
   * @param userId - Driver user ID
   * @returns Query key for driver stats
   */
  stats: (userId: string) => [...driverQueries.all(), 'stats', userId] as const,
  
  /**
   * Monthly batch completion summary
   * @param userId - Driver user ID
   * @returns Query key for monthly batches
   */
  monthlyBatches: (userId: string) => [...driverQueries.all(), 'monthly-batches', userId] as const,
};
