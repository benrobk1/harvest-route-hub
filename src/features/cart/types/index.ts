/**
 * CART DOMAIN TYPES
 * Shared type definitions for shopping cart across the application
 */

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithProduct extends CartItem {
  products: {
    id: string;
    name: string;
    unit: string;
    image_url: string | null;
    available_quantity: number;
    farm_profiles: {
      id: string;
      farm_name: string;
    };
  };
}

export interface ShoppingCart {
  id: string;
  consumer_id: string;
  created_at: string;
  updated_at: string;
  items: CartItemWithProduct[];
}

export interface SavedCart {
  id: string;
  consumer_id: string;
  name: string;
  items: any[]; // Stored as JSONB
  created_at: string;
  updated_at: string;
}

export interface AddToCartData {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface UpdateCartItemData {
  itemId: string;
  quantity: number;
}

export interface CartTotals {
  subtotal: number;
  itemCount: number;
}
