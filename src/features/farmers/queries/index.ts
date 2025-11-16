import type { CustomerZipSummary } from '@/features/farmers/types';

/**
 * FARMER QUERIES
 * Query factory pattern for farmer-related queries
 * 
 * @module features/farmers/queries
 * @description Centralized React Query keys and functions for farmer features.
 * Provides hierarchical query keys for efficient cache invalidation.
 * 
 * @example Basic usage
 * ```typescript
 * // Get farmer profile
 * const { data } = useQuery({ queryKey: farmerQueries.profile(userId) });
 * 
 * // Invalidate all farmer queries
 * queryClient.invalidateQueries({ queryKey: farmerQueries.all() });
 * 
 * // Invalidate only products
 * queryClient.invalidateQueries({ queryKey: farmerQueries.all(), 'products' });
 * ```
 */

export const farmerQueries = {
  /**
   * Base key for all farmer queries
   * @returns Base query key array
   */
  all: () => ['farmers'] as const,
  
  /**
   * Farmer profile query key
   * @param userId - Auth user ID
   * @returns Query key for farmer profile
   */
  profile: (userId: string) => [...farmerQueries.all(), 'profile', userId] as const,
  
  /**
   * Lead farmer specific queries
   */
  leadFarmer: {
    /**
     * Get batches for lead farmer's collection point
     * @param userId - Lead farmer's user ID
     * @returns Query key for lead farmer batches
     */
    batches: (userId: string) => [...farmerQueries.all(), 'lead-farmer-batches', userId] as const,
    
    /**
     * Get lead farmer information
     * @param leadFarmerId - Lead farmer profile ID
     * @returns Query key for lead farmer info
     */
    info: (leadFarmerId: string) => [...farmerQueries.all(), 'lead-farmer-info', leadFarmerId] as const,
    
    /**
     * Get collection point details for lead farmer
     * @param userId - Lead farmer's user ID
     * @returns Query key for collection point
     */
    collectionPoint: (userId: string) => [...farmerQueries.all(), 'collection-point', userId] as const,
  },
  
  /**
   * Get farms affiliated with a lead farmer (basic list)
   * @param userId - Lead farmer's user ID
   * @returns Query key for affiliated farms
   */
  affiliatedFarms: (userId: string) => [...farmerQueries.all(), 'affiliated-farms', userId] as const,
  
  /**
   * Get detailed information about affiliated farmers
   * @param userId - Lead farmer's user ID
   * @returns Query key for affiliated farmers with details
   */
  affiliatedFarmersDetailed: (userId: string) => 
    [...farmerQueries.all(), 'affiliated-farmers-detailed', userId] as const,
  
  /**
   * Get aggregate earnings across all affiliated farms (lead farmer only)
   * @param userId - Lead farmer's user ID
   * @returns Query key for aggregate earnings
   */
  aggregateEarnings: (userId: string) => [...farmerQueries.all(), 'aggregate-earnings', userId] as const,
  
  /**
   * Get all products for a farm
   * @param farmProfileId - Farm profile ID
   * @returns Query key for farm products
   */
  products: (farmProfileId: string) => [...farmerQueries.all(), 'products', farmProfileId] as const,
  
  /**
   * Get products pending weekly review/update
   * @param farmProfileId - Farm profile ID
   * @returns Query key for products needing review
   */
  productsReview: (farmProfileId: string) => 
    [...farmerQueries.all(), 'products-review', farmProfileId] as const,
  
  /**
   * Get orders for a specific farm
   * @param farmProfileId - Farm profile ID
   * @returns Query key for farm orders
   */
  orders: (farmProfileId: string) => [...farmerQueries.all(), 'orders', farmProfileId] as const,
  
  /**
   * Get farm-specific order data (alternative key structure)
   * @param farmProfileId - Farm profile ID
   * @returns Query key for farm orders
   */
  farmOrders: (farmProfileId: string) => [...farmerQueries.all(), 'farm-orders', farmProfileId] as const,
  
  /**
   * Get dashboard statistics for farmer
   * @param userId - Farmer's user ID
   * @returns Query key for farmer stats
   */
  stats: (userId: string) => [...farmerQueries.all(), 'stats', userId] as const,
  
  /**
   * Get currently active batch for farmer
   * @param userId - Farmer's user ID
   * @returns Query key for active batch
   */
  activeBatch: (userId: string) => [...farmerQueries.all(), 'active-batch', userId] as const,
  
  /**
   * Get monthly batch summary for farmer
   * @param userId - Farmer's user ID
   * @returns Query key for monthly batches
   */
  monthlyBatches: (userId: string) => [...farmerQueries.all(), 'monthly-batches', userId] as const,
  
  /**
   * Get customer analytics grouped by ZIP code
   * @param userId - Farmer's user ID
   * @param isLeadFarmer - Whether user is a lead farmer
   * @returns Query key for customer analytics
   */
  customerAnalytics: (userId: string, isLeadFarmer: boolean) => 
    [...farmerQueries.all(), 'customer-analytics-zip', userId, isLeadFarmer] as const,
  
  /**
   * Get customer summary statistics
   * @param userId - Farmer's user ID
   * @param displayZipData - ZIP data to display
   * @returns Query key for customer summary
   */
  customerSummary: (userId: string, displayZipData: readonly CustomerZipSummary[]) =>
    [...farmerQueries.all(), 'customer-summary', userId, displayZipData] as const,
};
