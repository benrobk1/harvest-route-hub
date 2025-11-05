/**
 * PRODUCT QUERIES
 * Query factory pattern for product-related queries
 * 
 * @module features/products/queries
 * @description Centralized React Query keys for product catalog, search, and marketplace data.
 * Includes shop products, farmer info, and market configuration.
 * 
 * @example Usage
 * ```typescript
 * // Get shop products
 * const { data } = useQuery({ queryKey: productQueries.shop() });
 * 
 * // Get product details
 * const { data } = useQuery({ queryKey: productQueries.detail(productId) });
 * 
 * // Get market config
 * const { data } = useQuery({ queryKey: productQueries.marketConfig(zipCode) });
 * ```
 */

export const productQueries = {
  /**
   * Base key for all product queries
   * @returns Base query key array for products
   */
  all: () => ['products'] as const,
  
  /**
   * Shop products available for purchase
   * Includes approved products with inventory > 0
   * @returns Query key for shop product list
   */
  shop: () => [...productQueries.all(), 'shop'] as const,
  
  /**
   * Individual product details
   * @param productId - Product UUID
   * @returns Query key for product details
   */
  detail: (productId: string) => [...productQueries.all(), 'detail', productId] as const,
  
  /**
   * Batch fetch farmer profiles for products
   * @param farmProfileIds - Array of farm profile IDs
   * @returns Query key for farmers batch
   */
  farmers: (farmProfileIds: string[]) => ['farmers-batch', farmProfileIds] as const,
  
  /**
   * Market configuration for a ZIP code
   * Includes delivery fees, cutoff times, etc.
   * @param zipCode - 5-digit ZIP code
   * @returns Query key for market config
   */
  marketConfig: (zipCode: string) => ['market-config-shop', zipCode] as const,
};
