import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { productQueries } from '../queries';
import type { Product } from '../types';

export const useShopProducts = () => {
  const { user } = useAuth();

  const { data: products = [], isLoading } = useQuery({
    queryKey: productQueries.shop(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          farm_profiles!inner (
            id,
            farm_name,
            location
          )
        `)
        .gt("available_quantity", 0)
        .eq("approved", true);

      if (error) throw error;
      return data as Product[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const farmProfileIds = useMemo(() => 
    [...new Set(products.map(p => p.farm_profile_id))],
    [products]
  );

  const { data: farmerData } = useQuery({
    queryKey: productQueries.farmers(farmProfileIds),
    queryFn: async () => {
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
    },
    enabled: farmProfileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: consumerProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('zip_code')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: marketConfig } = useQuery({
    queryKey: productQueries.marketConfig('10001'),
    queryFn: async () => {
      const { data } = await supabase
        .from('market_configs')
        .select('*')
        .eq('zip_code', '10001')
        .eq('active', true)
        .maybeSingle();
      return data;
    },
  });

  return {
    products,
    isLoading,
    farmerData,
    consumerProfile,
    marketConfig,
  };
};
