/**
 * PRODUCT REPOSITORY INTERFACE
 * Defines the contract for product data access operations
 */

import type { Product } from '@/features/products/types';

export interface IProductRepository {
  /**
   * Fetch all approved products with available inventory
   */
  getShopProducts(): Promise<Product[]>;

  /**
   * Fetch farmer profile data for given farm profile IDs
   */
  getFarmerProfiles(farmProfileIds: string[]): Promise<Record<string, any>>;

  /**
   * Fetch consumer profile by user ID
   */
  getConsumerProfile(userId: string): Promise<any>;

  /**
   * Fetch active market configuration for a ZIP code
   */
  getMarketConfig(zipCode: string): Promise<any>;

  /**
   * Fetch single product by ID
   */
  getProductById(productId: string): Promise<Product | null>;
}
