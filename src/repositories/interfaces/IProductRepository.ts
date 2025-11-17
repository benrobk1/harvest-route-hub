/**
 * PRODUCT REPOSITORY INTERFACE
 * Defines the contract for product data access operations
 */

import type { Product } from '@/features/products/types';
import type { Database } from '@/integrations/supabase/types';

type FarmProfile = Database['public']['Tables']['farm_profiles']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type MarketConfig = Database['public']['Tables']['market_configs']['Row'];

export type FarmerProfileWithUser = Pick<FarmProfile, 'id' | 'farmer_id'> & {
  profiles?: Pick<Profile, 'avatar_url' | 'full_name'> | null;
};

export interface IProductRepository {
  /**
   * Fetch all approved products with available inventory
   */
  getShopProducts(): Promise<Product[]>;

  /**
   * Fetch farmer profile data for given farm profile IDs
   */
  getFarmerProfiles(farmProfileIds: string[]): Promise<Record<string, FarmerProfileWithUser>>;

  /**
   * Fetch consumer profile by user ID
   */
  getConsumerProfile(userId: string): Promise<Profile | null>;

  /**
   * Fetch active market configuration for a ZIP code
   */
  getMarketConfig(zipCode: string): Promise<MarketConfig | null>;

  /**
   * Fetch single product by ID
   */
  getProductById(productId: string): Promise<Product | null>;
}
