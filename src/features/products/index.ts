/**
 * PRODUCTS FEATURE MODULE
 * Public API for products functionality
 * Centralized exports following feature-based architecture
 */

// Hooks
export { useShopProducts } from './hooks/useShopProducts';
export { useProductSearch } from './hooks/useProductSearch';

// Types
export type { Product, ProductWithFarmer, ShopData } from './types';

// Queries
export { productQueries } from './queries';

// Errors
export * from './errors';
