/**
 * PRODUCT QUERIES
 * Query factory pattern for product-related queries
 * Centralized query key management for TanStack Query
 */

export const productQueries = {
  // Base key for all product queries
  all: () => ['products'] as const,
  
  // Shop products (available for purchase)
  shop: () => [...productQueries.all(), 'shop'] as const,
  
  // Product details
  detail: (productId: string) => [...productQueries.all(), 'detail', productId] as const,
  
  // Farmers data
  farmers: (farmProfileIds: string[]) => ['farmers-batch', farmProfileIds] as const,
  
  // Market configuration
  marketConfig: (zipCode: string) => ['market-config-shop', zipCode] as const,
};
