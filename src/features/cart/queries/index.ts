/**
 * CART QUERIES
 * Query factory pattern for cart-related queries
 * 
 * @module features/cart/queries
 * @description Centralized React Query keys for shopping cart and saved carts.
 * Manages both active shopping cart and saved cart functionality.
 * 
 * @example Usage in components
 * ```typescript
 * // Get current cart
 * const { data } = useQuery({ queryKey: cartQueries.current(userId) });
 * 
 * // Get cart items
 * const { data } = useQuery({ queryKey: cartQueries.items(cartId) });
 * 
 * // Invalidate after adding item
 * queryClient.invalidateQueries({ queryKey: cartQueries.all() });
 * ```
 */

export const cartQueries = {
  /**
   * Base key for all cart queries
   * @returns Base query key array for cart data
   */
  all: () => ['cart'] as const,
  
  /**
   * Current active shopping cart for user
   * @param userId - Optional user ID (undefined for anonymous carts)
   * @returns Query key for current cart
   */
  current: (userId?: string) => [...cartQueries.all(), userId] as const,
  
  /**
   * Cart items with product details
   * @param cartId - Shopping cart ID
   * @returns Query key for cart items
   */
  items: (cartId: string) => [...cartQueries.all(), 'items', cartId] as const,
  
  /**
   * Cart totals calculation (subtotal, fees, taxes, etc.)
   * @param userId - Optional user ID
   * @returns Query key for cart totals
   */
  totals: (userId?: string) => [...cartQueries.all(), 'totals', userId] as const,
  
  /**
   * Saved carts namespace for cart templates
   */
  saved: {
    /**
     * All saved carts for a user
     * @param userId - Optional user ID
     * @returns Query key for saved carts list
     */
    all: (userId?: string) => ['saved-carts', userId] as const,
    
    /**
     * Individual saved cart with items
     * @param savedCartId - Saved cart ID
     * @returns Query key for saved cart details
     */
    detail: (savedCartId: string) => ['saved-carts', 'detail', savedCartId] as const,
  },
};
