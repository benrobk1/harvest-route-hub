import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { POLLING_INTERVALS } from '@/config/ui-constants';
import { getOrderRepository } from '@/repositories';
import { orderQueries } from '../queries';
import type { OrderWithDetails } from '../types';

/**
 * Hook for tracking consumer's active order in real-time
 * 
 * @description Fetches and subscribes to updates for the user's active order
 * (confirmed, in_transit, or out_for_delivery status). Includes automatic polling
 * and real-time Supabase subscription for instant status updates.
 * 
 * @returns Active order data and loading state
 * 
 * @example
 * ```typescript
 * const { activeOrder, isLoading } = useActiveOrder();
 * 
 * if (activeOrder?.status === 'out_for_delivery') {
 *   // Show live tracking UI
 * }
 * ```
 */
export const useActiveOrder = () => {
  const { user } = useAuth();
  const orderRepo = getOrderRepository();

  const { data: activeOrder, isLoading, refetch } = useQuery({
    queryKey: orderQueries.active(user?.id || ''),
    queryFn: () => user ? orderRepo.getActiveOrder(user.id) : null,
    enabled: !!user?.id,
    refetchInterval: POLLING_INTERVALS.ACTIVE_ORDER,
  });

  useEffect(() => {
    if (!user?.id) return;
    return orderRepo.subscribeToOrderUpdates(user.id, () => refetch());
  }, [user?.id, refetch, orderRepo]);

  return {
    activeOrder,
    isLoading,
  };
};
