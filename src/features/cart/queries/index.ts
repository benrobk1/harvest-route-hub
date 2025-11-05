/**
 * CART QUERIES
 * Query factory pattern for cart-related queries
 * Centralized query key management for TanStack Query
 */

export const cartQueries = {
  // Base key for all cart queries
  all: () => ['cart'] as const,
  
  // Current shopping cart
  current: (userId?: string) => [...cartQueries.all(), userId] as const,
  
  // Cart items
  items: (cartId: string) => [...cartQueries.all(), 'items', cartId] as const,
  
  // Cart totals
  totals: (userId?: string) => [...cartQueries.all(), 'totals', userId] as const,
  
  // Saved carts
  saved: {
    all: (userId?: string) => ['saved-carts', userId] as const,
    detail: (savedCartId: string) => ['saved-carts', 'detail', savedCartId] as const,
  },
};
