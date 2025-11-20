/**
 * ORDERS DOMAIN TYPES
 * Shared type definitions for orders across the application
 */

export interface Order {
  id: string;
  consumer_id: string;
  status: 'pending' | 'confirmed' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled';
  total_amount: number;
  delivery_date: string;
  box_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface OrderItemProduct {
  id: string;
  name: string;
  unit: string;
  farm_profiles: {
    id: string;
    farm_name: string;
  };
}

export interface OrderItemWithDetails extends OrderItem {
  products: OrderItemProduct;
}

export interface OrderWithDetails extends Order {
  order_items: OrderItemWithDetails[];
  delivery_batches: {
    driver_id: string;
    estimated_duration_minutes: number | null;
    profiles: {
      full_name: string;
      phone: string | null;
    };
  } | null;
  profiles: {
    street_address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  };
}
