/**
 * PRODUCTS DOMAIN TYPES
 * Shared type definitions for products across the application
 */

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  available_quantity: number;
  image_url: string | null;
  farm_profile_id: string;
  harvest_date: string | null;
  farm_profiles: {
    id: string;
    farm_name: string;
    location: string | null;
  };
}

export interface ProductWithFarmer extends Product {
  farmer_data?: {
    avatar_url: string | null;
    full_name: string;
  };
}

export interface ShopData {
  products: Product[];
  farmerData: Record<string, any>;
  consumerProfile: {
    zip_code: string | null;
  } | null;
  marketConfig: {
    cutoff_time: string | null;
    delivery_days: string[] | null;
  } | null;
}
