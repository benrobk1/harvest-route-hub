/**
 * SUPABASE ORDER REPOSITORY
 * Implements order data access using Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import type { IOrderRepository } from '../interfaces/IOrderRepository';
import type { OrderWithDetails } from '@/features/orders/types';

export class SupabaseOrderRepository implements IOrderRepository {
  async getActiveOrder(consumerId: string): Promise<OrderWithDetails | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        consumer_id,
        status,
        total_amount,
        delivery_date,
        box_code,
        created_at,
        updated_at,
        order_items(
          quantity,
          products(name, unit)
        ),
        delivery_batches(
          driver_id,
          estimated_duration_minutes,
          profiles!delivery_batches_driver_id_fkey(full_name, phone)
        ),
        profiles!orders_consumer_id_fkey(street_address, city, state, zip_code)
      `)
      .eq('consumer_id', consumerId)
      .in('status', ['confirmed', 'in_transit', 'out_for_delivery'])
      .order('delivery_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    return {
      ...data,
      delivery_batches: Array.isArray(data.delivery_batches) && data.delivery_batches.length > 0
        ? data.delivery_batches[0]
        : null,
    } as OrderWithDetails;
  }

  subscribeToOrderUpdates(consumerId: string, callback: () => void): () => void {
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `consumer_id=eq.${consumerId}`,
        },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async getOrderById(orderId: string): Promise<OrderWithDetails | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        consumer_id,
        status,
        total_amount,
        delivery_date,
        box_code,
        created_at,
        updated_at,
        order_items(
          quantity,
          unit_price,
          products(name, unit, image_url)
        ),
        delivery_batches(
          driver_id,
          estimated_duration_minutes,
          profiles!delivery_batches_driver_id_fkey(full_name, phone)
        ),
        profiles!orders_consumer_id_fkey(street_address, city, state, zip_code)
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    
    return {
      ...data,
      delivery_batches: Array.isArray(data.delivery_batches) && data.delivery_batches.length > 0
        ? data.delivery_batches[0]
        : null,
    } as OrderWithDetails;
  }

  async getConsumerOrders(consumerId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_amount,
        delivery_date,
        created_at
      `)
      .eq('consumer_id', consumerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}
