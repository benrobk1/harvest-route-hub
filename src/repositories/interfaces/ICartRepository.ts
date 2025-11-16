/**
 * CART REPOSITORY INTERFACE
 * Defines the contract for shopping cart data access operations
 */

import type { ShoppingCart, SavedCart } from '@/features/cart/types';

export interface ICartRepository {
  /**
   * Get or create shopping cart for a consumer
   */
  getOrCreateCart(consumerId: string): Promise<ShoppingCart>;

  /**
   * Add item to cart or update quantity if exists
   */
  addItemToCart(params: {
    cartId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    existingQuantity?: number;
    itemId?: string;
  }): Promise<void>;

  /**
   * Update cart item quantity (or remove if quantity <= 0)
   */
  updateCartItemQuantity(itemId: string, quantity: number): Promise<void>;

  /**
   * Remove item from cart
   */
  removeCartItem(itemId: string): Promise<void>;

  /**
   * Get all saved carts for a consumer
   */
  getSavedCarts(consumerId: string): Promise<SavedCart[]>;

  /**
   * Save current cart as a template
   */
  saveCart(params: {
    consumerId: string;
    name: string;
    items: any[];
  }): Promise<void>;

  /**
   * Load saved cart into active cart
   */
  loadSavedCart(params: {
    cartId: string;
    savedCartItems: any[];
  }): Promise<void>;

  /**
   * Delete a saved cart
   */
  deleteSavedCart(savedCartId: string): Promise<void>;
}
