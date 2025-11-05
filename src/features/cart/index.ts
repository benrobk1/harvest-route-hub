/**
 * CART FEATURE MODULE
 * Public API for cart functionality
 * Centralized exports following feature-based architecture
 */

// Components
export { CartDrawer } from './components/CartDrawer';
export { SaveCartDialog } from './components/SaveCartDialog';
export { SavedCartsList } from './components/SavedCartsList';
export { default as CartItemSkeleton } from './components/CartItemSkeleton';

// Hooks
export { useCart } from './hooks/useCart';
export { useCartActions } from './hooks/useCartActions';

// Types
export type {
  CartItem,
  CartItemWithProduct,
  ShoppingCart,
  SavedCart,
  AddToCartData,
  UpdateCartItemData,
  CartTotals,
} from './types';

// Queries
export { cartQueries } from './queries';
