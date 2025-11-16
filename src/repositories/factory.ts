/**
 * REPOSITORY FACTORY
 * Creates and provides repository instances
 * 
 * This factory pattern allows easy swapping of implementations
 * (e.g., from Supabase to another backend) without changing consumer code
 */

import type { IProductRepository } from './interfaces/IProductRepository';
import type { ICartRepository } from './interfaces/ICartRepository';
import type { IOrderRepository } from './interfaces/IOrderRepository';
import { SupabaseProductRepository } from './supabase/SupabaseProductRepository';
import { SupabaseCartRepository } from './supabase/SupabaseCartRepository';
import { SupabaseOrderRepository } from './supabase/SupabaseOrderRepository';

// Singleton instances
let productRepository: IProductRepository | null = null;
let cartRepository: ICartRepository | null = null;
let orderRepository: IOrderRepository | null = null;

/**
 * Get product repository instance
 */
export const getProductRepository = (): IProductRepository => {
  if (!productRepository) {
    productRepository = new SupabaseProductRepository();
  }
  return productRepository;
};

/**
 * Get cart repository instance
 */
export const getCartRepository = (): ICartRepository => {
  if (!cartRepository) {
    cartRepository = new SupabaseCartRepository();
  }
  return cartRepository;
};

/**
 * Get order repository instance
 */
export const getOrderRepository = (): IOrderRepository => {
  if (!orderRepository) {
    orderRepository = new SupabaseOrderRepository();
  }
  return orderRepository;
};

/**
 * Reset all repository instances (useful for testing)
 */
export const resetRepositories = () => {
  productRepository = null;
  cartRepository = null;
  orderRepository = null;
};
