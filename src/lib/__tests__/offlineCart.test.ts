import { describe, it, expect, beforeEach } from 'vitest';
import { saveCartOffline, getCartOffline, clearCartOffline } from '../offlineCart';

describe('offlineCart', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('saveCartOffline', () => {
    it('should save cart items to localStorage', () => {
      const cartItems = [
        { productId: 'prod-1', quantity: 2, unitPrice: 5.99, productName: 'Tomatoes', farmName: 'Green Acres' },
        { productId: 'prod-2', quantity: 1, unitPrice: 3.99, productName: 'Lettuce', farmName: 'Sunny Farm' },
      ];

      saveCartOffline(cartItems);

      const saved = localStorage.getItem('blue_harvests_offline_cart');
      expect(saved).toBeTruthy();
      expect(JSON.parse(saved!)).toEqual(cartItems);
    });

    it('should overwrite existing cart', () => {
      const oldCart = [{ productId: 'prod-1', quantity: 1, unitPrice: 5.99, productName: 'Tomatoes', farmName: 'Green Acres' }];
      const newCart = [{ productId: 'prod-2', quantity: 3, unitPrice: 3.99, productName: 'Lettuce', farmName: 'Sunny Farm' }];

      saveCartOffline(oldCart);
      saveCartOffline(newCart);

      const saved = JSON.parse(localStorage.getItem('blue_harvests_offline_cart')!);
      expect(saved).toEqual(newCart);
    });
  });

  describe('getCartOffline', () => {
    it('should retrieve saved cart items', () => {
      const cartItems = [
        { productId: 'prod-1', quantity: 2, unitPrice: 5.99, productName: 'Tomatoes', farmName: 'Green Acres' },
      ];

      localStorage.setItem('blue_harvests_offline_cart', JSON.stringify(cartItems));

      const retrieved = getCartOffline();
      expect(retrieved).toEqual(cartItems);
    });

    it('should return empty array if no cart exists', () => {
      const retrieved = getCartOffline();
      expect(retrieved).toEqual([]);
    });

    it('should return empty array if cart data is invalid', () => {
      localStorage.setItem('blue_harvests_offline_cart', 'invalid json');
      const retrieved = getCartOffline();
      expect(retrieved).toEqual([]);
    });
  });

  describe('clearCartOffline', () => {
    it('should remove cart from localStorage', () => {
      const cartItems = [{ productId: 'prod-1', quantity: 2, unitPrice: 5.99, productName: 'Tomatoes', farmName: 'Green Acres' }];
      localStorage.setItem('blue_harvests_offline_cart', JSON.stringify(cartItems));

      clearCartOffline();

      expect(localStorage.getItem('blue_harvests_offline_cart')).toBeNull();
    });

    it('should not throw if cart does not exist', () => {
      expect(() => clearCartOffline()).not.toThrow();
    });
  });
});
