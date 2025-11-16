/**
 * SUPABASE PRODUCT REPOSITORY
 * Implements product data access using Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type { IProductRepository } from '../interfaces/IProductRepository';
import type { Product } from '@/features/products/types';

export class SupabaseProductRepository implements IProductRepository {
  async getShopProducts(): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        farm_profiles!inner (
          id,
          farm_name,
          location
        )
      `)
      .gt('available_quantity', 0)
      .eq('approved', true);

    if (error) throw error;
    return data as Product[];
  }

  async getFarmerProfiles(farmProfileIds: string[]): Promise<Record<string, any>> {
    if (farmProfileIds.length === 0) return {};

    const { data } = await supabase
      .from('farm_profiles')
      .select(`
        id,
        farmer_id,
        profiles!farm_profiles_farmer_id_fkey (
          avatar_url,
          full_name
        )
      `)
      .in('id', farmProfileIds);

    const map: Record<string, any> = {};
    data?.forEach(farm => {
      map[farm.id] = farm;
    });
    return map;
  }

  async getConsumerProfile(userId: string): Promise<any> {
    const { data } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        street_address,
        address_line_2,
        city,
        state,
        zip_code,
        avatar_url
      `)
      .eq('id', userId)
      .single();
    return data;
  }

  async getMarketConfig(zipCode: string): Promise<any> {
    const { data } = await supabase
      .from('market_configs')
      .select('*')
      .eq('zip_code', zipCode)
      .eq('active', true)
      .maybeSingle();
    return data;
  }

  async getProductById(productId: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        farm_profiles!inner (
          id,
          farm_name,
          location
        )
      `)
      .eq('id', productId)
      .single();

    if (error) throw error;
    return data as Product;
  }
}
