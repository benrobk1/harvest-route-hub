import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useMemo } from 'react';
import { useErrorHandler } from '@/lib/errors/useErrorHandler';
import { createValidationError } from '@/lib/errors/ErrorTypes';
import { getCartRepository } from '@/repositories';
import { cartQueries } from '../queries';
import type { ShoppingCart, AddToCartData, UpdateCartItemData, SavedCart } from '../types';

export const useCart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { handleError } = useErrorHandler();
  const cartRepo = getCartRepository();

  // Fetch current cart
  const { data: cart, isLoading } = useQuery<ShoppingCart | null>({
    queryKey: cartQueries.current(user?.id),
    queryFn: () => user ? cartRepo.getOrCreateCart(user.id) : null,
    enabled: !!user,
  });

  // Add to cart mutation
  const addToCart = useMutation({
    mutationFn: async ({ productId, quantity, unitPrice }: AddToCartData) => {
      if (!cart?.id) throw createValidationError('No active cart found');

      const existingItem = cart.items.find(item => item.product_id === productId);

      await cartRepo.addItemToCart({
        cartId: cart.id,
        productId,
        quantity,
        unitPrice,
        existingQuantity: existingItem?.quantity,
        itemId: existingItem?.id,
      });
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
    mutationFn: ({ itemId, quantity }: UpdateCartItemData) => 
      cartRepo.updateCartItemQuantity(itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueries.current(user?.id) });
    },
    onError: (error) => {
      handleError(error);
    },
  });

  // Remove item from cart
  const removeItem = useMutation({
    mutationFn: (itemId: string) => cartRepo.removeCartItem(itemId),
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
    queryFn: () => user ? cartRepo.getSavedCarts(user.id) : [],
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

      await cartRepo.saveCart({
        consumerId: user!.id,
        name,
        items: cartSnapshot,
      });
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

      await cartRepo.loadSavedCart({
        cartId: cart.id,
        savedCartItems: savedCart.items,
      });
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
    mutationFn: (savedCartId: string) => cartRepo.deleteSavedCart(savedCartId),
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
