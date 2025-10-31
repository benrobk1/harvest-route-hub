/**
 * Offline cart management using localStorage
 * (IndexedDB would be better for production but requires more setup)
 */

export interface OfflineCartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  farmName: string;
}

const CART_KEY = 'blue_harvests_offline_cart';
const CART_TIMESTAMP_KEY = 'blue_harvests_offline_cart_timestamp';

export const saveCartOffline = (items: OfflineCartItem[]): void => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    localStorage.setItem(CART_TIMESTAMP_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Failed to save cart offline:', error);
  }
};

export const getCartOffline = (): OfflineCartItem[] => {
  try {
    const cart = localStorage.getItem(CART_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch (error) {
    console.error('Failed to get cart offline:', error);
    return [];
  }
};

export const clearCartOffline = (): void => {
  try {
    localStorage.removeItem(CART_KEY);
    localStorage.removeItem(CART_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Failed to clear cart offline:', error);
  }
};

export const getCartTimestamp = (): Date | null => {
  try {
    const timestamp = localStorage.getItem(CART_TIMESTAMP_KEY);
    return timestamp ? new Date(timestamp) : null;
  } catch (error) {
    console.error('Failed to get cart timestamp:', error);
    return null;
  }
};

// Check if offline
export const isOffline = (): boolean => {
  return !navigator.onLine;
};

// Listen for online event to sync cart
export const setupOfflineSync = (syncCallback: () => void) => {
  const handleOnline = () => {
    const offlineCart = getCartOffline();
    if (offlineCart.length > 0) {
      console.log('Back online - syncing cart...');
      syncCallback();
    }
  };

  window.addEventListener('online', handleOnline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
};
