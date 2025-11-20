import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getProductRepository } from '@/repositories';
import { productQueries } from '../queries';

/**
 * Hook for fetching shop products with farmer and market data
 * 
 * @description Loads approved products with available inventory, along with
 * associated farmer profile data and market configuration. Optimizes farmer
 * data fetching by batching unique farm profile IDs.
 * 
 * @returns Products, farmer data, consumer profile, market config, and loading state
 * 
 * @example
 * ```typescript
 * const { products, farmerData, marketConfig, isLoading } = useShopProducts();
 * 
 * products.forEach(product => {
 *   const farmer = farmerData?.[product.farm_profile_id];
 *   // Render product with farmer info
 * });
 * ```
 */
export const useShopProducts = () => {
  const { user } = useAuth();
  const productRepo = getProductRepository();

  const { data: products = [], isLoading } = useQuery({
    queryKey: productQueries.shop(),
    queryFn: () => productRepo.getShopProducts(),
    staleTime: 5 * 60 * 1000,
  });

  const farmProfileIds = useMemo(() => 
    [...new Set(products.map(p => p.farm_profile_id))],
    [products]
  );

  const { data: farmerData } = useQuery({
    queryKey: productQueries.farmers(farmProfileIds),
    queryFn: () => productRepo.getFarmerProfiles(farmProfileIds),
    enabled: farmProfileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const { data: consumerProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => user ? productRepo.getConsumerProfile(user.id) : null,
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: marketConfig } = useQuery({
    queryKey: productQueries.marketConfig('10001'),
    queryFn: () => productRepo.getMarketConfig('10001'),
  });

  return {
    products,
    isLoading,
    farmerData,
    consumerProfile,
    marketConfig,
  };
};
