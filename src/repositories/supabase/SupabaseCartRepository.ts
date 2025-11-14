/**
 * SUPABASE CART REPOSITORY
 * Implements cart data access using Supabase
 */

import { supabase } from '@/integrations/supabase/client';
import { createCartError } from '@/lib/errors/ErrorTypes';
import type { ICartRepository } from '../interfaces/ICartRepository';
import type { ShoppingCart, SavedCart } from '@/features/cart/types';

export class SupabaseCartRepository implements ICartRepository {
  async getOrCreateCart(consumerId: string): Promise<ShoppingCart> {
    let existingCart;
    const { data, error: fetchError } = await supabase
      .from('shopping_carts')
      .select(`
        *,
        items:cart_items(
          *,
          products(
            id,
            name,
            unit,
            image_url,
            available_quantity,
            farm_profiles(
              id,
              farm_name
            )
          )
        )
      `)
      .eq('consumer_id', consumerId)
      .single();

    existingCart = data;

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw createCartError('Failed to load cart');
    }

    if (!existingCart) {
      const { data: newCart, error: createError } = await supabase
        .from('shopping_carts')
        .insert({ consumer_id: consumerId })
        .select(`
          *,
          items:cart_items(
            *,
            products(
              id,
              name,
              unit,
              image_url,
              available_quantity,
              farm_profiles(
                id,
                farm_name
              )
            )
          )
        `)
        .single();

      if (createError) throw createCartError('Failed to create cart');
      existingCart = newCart;
    }

    return existingCart as ShoppingCart;
  }

  async addItemToCart(params: {
    cartId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    existingQuantity?: number;
    itemId?: string;
  }): Promise<void> {
    if (params.itemId && params.existingQuantity !== undefined) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: params.existingQuantity + params.quantity })
        .eq('id', params.itemId);

      if (error) throw createCartError('Failed to update cart item');
    } else {
      const { error } = await supabase
        .from('cart_items')
        .insert({
          cart_id: params.cartId,
          product_id: params.productId,
          quantity: params.quantity,
          unit_price: params.unitPrice,
        });

      if (error) throw createCartError('Failed to add item to cart');
    }
  }

  async updateCartItemQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await this.removeCartItem(itemId);
    } else {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (error) throw createCartError('Failed to update quantity');
    }
  }

  async removeCartItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId);

    if (error) throw createCartError('Failed to remove item');
  }

  async getSavedCarts(consumerId: string): Promise<SavedCart[]> {
    const { data, error } = await supabase
      .from('saved_carts')
      .select('*')
      .eq('consumer_id', consumerId)
      .order('created_at', { ascending: false });

    if (error) throw createCartError('Failed to load saved carts');
    return data as SavedCart[];
  }

  async saveCart(params: {
    consumerId: string;
    name: string;
    items: any[];
  }): Promise<void> {
    const { error } = await supabase
      .from('saved_carts')
      .insert({
        consumer_id: params.consumerId,
        name: params.name,
        items: params.items,
      });

    if (error) throw createCartError('Failed to save cart');
  }

  async loadSavedCart(params: {
    cartId: string;
    savedCartItems: any[];
  }): Promise<void> {
    await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', params.cartId);

    const itemsToInsert = params.savedCartItems.map((item: any) => ({
      cart_id: params.cartId,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error } = await supabase
      .from('cart_items')
      .insert(itemsToInsert);

    if (error) throw createCartError('Failed to load saved cart');
  }

  async deleteSavedCart(savedCartId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_carts')
      .delete()
      .eq('id', savedCartId);

    if (error) throw createCartError('Failed to delete saved cart');
  }
}
