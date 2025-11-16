import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { useErrorHandler } from '@/lib/errors/useErrorHandler';
import { createCartError, createValidationError } from '@/lib/errors/ErrorTypes';
import { cartQueries } from '../queries';
import type { ShoppingCart, AddToCartData, UpdateCartItemData, SavedCart } from '../types';

export const useCart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();

  // Fetch current cart
  const { data: cart, isLoading } = useQuery<ShoppingCart | null>({
    queryKey: cartQueries.current(user?.id),
    queryFn: async () => {
      if (!user) return null;

      const { data: existingCart, error: fetchError } = await supabase
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
        .eq('consumer_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw createCartError('Failed to load cart');
      }

      if (!existingCart) {
        const { data: newCart, error: createError } = await supabase
          .from('shopping_carts')
          .insert({ consumer_id: user.id })
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
    },
    enabled: !!user,
  });

  // Add to cart mutation
  const addToCart = useMutation({
    mutationFn: async ({ productId, quantity, unitPrice }: AddToCartData) => {
      if (!cart?.id) throw createValidationError('No active cart found');

      const existingItem = cart.items.find(item => item.product_id === productId);

      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        if (error) throw createCartError('Failed to update cart item');
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
          });

        if (error) throw createCartError('Failed to add item to cart');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.current(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Update cart item quantity
  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: UpdateCartItemData) => {
      if (quantity <= 0) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId);

        if (error) throw createCartError('Failed to remove item');
      } else {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity })
          .eq('id', itemId);

        if (error) throw createCartError('Failed to update quantity');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.current(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Remove item from cart
  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw createCartError('Failed to remove item');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.current(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Fetch saved carts
  const { data: savedCarts = [] } = useQuery<SavedCart[]>({
    queryKey: cartQueries.saved.all(user?.id),
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('saved_carts')
        .select('*')
        .eq('consumer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw createCartError('Failed to load saved carts');
      return data as SavedCart[];
    },
    enabled: !!user,
  });

  // Save current cart
  const saveCart = useMutation({
    mutationFn: async (name: string) => {
      if (!cart?.items || cart.items.length === 0) {
        throw createValidationError('Cannot save an empty cart');
      }

      const cartSnapshot = cart.items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product_name: item.products.name,
        farm_name: item.products.farm_profiles.farm_name,
      }));

      const { error } = await supabase
        .from('saved_carts')
        .insert({
          consumer_id: user!.id,
          name,
          items: cartSnapshot,
        });

      if (error) throw createCartError('Failed to save cart');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.saved.all(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Load saved cart
  const loadSavedCart = useMutation({
    mutationFn: async (savedCartId: string) => {
      if (!cart?.id) throw createValidationError('No active cart found');

      const savedCart = savedCarts.find(sc => sc.id === savedCartId);
      if (!savedCart) throw createValidationError('Saved cart not found');

      await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cart.id);

      const itemsToInsert = savedCart.items.map((item: any) => ({
        cart_id: cart.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      const { error } = await supabase
        .from('cart_items')
        .insert(itemsToInsert);

      if (error) throw createCartError('Failed to load saved cart');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.current(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Delete saved cart
  const deleteSavedCart = useMutation({
    mutationFn: async (savedCartId: string) => {
      const { error } = await supabase
        .from('saved_carts')
        .delete()
        .eq('id', savedCartId);

      if (error) throw createCartError('Failed to delete saved cart');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.saved.all(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Computed values
  const cartTotal = useMemo(() => {
    if (!cart?.items) return 0;
    return cart.items.reduce((sum, item) => sum + (item.quantity * Number(item.unit_price)), 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    if (!cart?.items) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return {
    cart,
    cartTotal,
    cartCount,
    isLoading,
    addToCart,
    updateQuantity,
    removeItem,
    savedCarts,
    saveCart,
    loadSavedCart,
    deleteSavedCart,
  };
};
