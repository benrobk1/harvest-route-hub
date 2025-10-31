import { describe, it, expect } from 'vitest';
import {
  calculateDeliveryFee,
  calculateRevenueSplit,
  calculateDriverPayout,
} from '../deliveryFeeHelpers';

describe('calculateDeliveryFee', () => {
  it('calculates 5% delivery fee correctly', () => {
    expect(calculateDeliveryFee(100.00)).toBe(5.00);
    expect(calculateDeliveryFee(47.50)).toBe(2.38);
    expect(calculateDeliveryFee(200.00)).toBe(10.00);
  });

  it('rounds to 2 decimal places', () => {
    expect(calculateDeliveryFee(33.33)).toBe(1.67); // 1.6665 → 1.67
    expect(calculateDeliveryFee(66.67)).toBe(3.33); // 3.3335 → 3.33
  });

  it('handles zero and small amounts', () => {
    expect(calculateDeliveryFee(0)).toBe(0.00);
    expect(calculateDeliveryFee(1.00)).toBe(0.05);
    expect(calculateDeliveryFee(10.00)).toBe(0.50);
  });

  it('handles large amounts', () => {
    expect(calculateDeliveryFee(1000.00)).toBe(50.00);
    expect(calculateDeliveryFee(5000.00)).toBe(250.00);
  });
});

describe('calculateRevenueSplit', () => {
  it('splits 90/5/5 correctly', () => {
    const split = calculateRevenueSplit(100.00);
    expect(split.farmerShare).toBe(90.00);
    expect(split.platformFee).toBe(5.00);
    expect(split.deliveryFee).toBe(5.00);
  });

  it('total always equals input', () => {
    const split = calculateRevenueSplit(127.45);
    const total = split.farmerShare + split.platformFee + split.deliveryFee;
    expect(total).toBeCloseTo(127.45, 2);
  });

  it('handles edge cases', () => {
    expect(calculateRevenueSplit(0).farmerShare).toBe(0);
    expect(calculateRevenueSplit(1.00).deliveryFee).toBe(0.05);
  });

  it('maintains correct proportions for various amounts', () => {
    const testAmounts = [50, 75, 150, 250, 1000];
    
    testAmounts.forEach(amount => {
      const split = calculateRevenueSplit(amount);
      
      // Verify proportions
      expect(split.farmerShare).toBeCloseTo(amount * 0.90, 2);
      expect(split.platformFee).toBeCloseTo(amount * 0.05, 2);
      expect(split.deliveryFee).toBeCloseTo(amount * 0.05, 2);
      
      // Verify total
      const total = split.farmerShare + split.platformFee + split.deliveryFee;
      expect(total).toBeCloseTo(amount, 2);
    });
  });

  it('farmer always receives largest share', () => {
    const split = calculateRevenueSplit(100.00);
    expect(split.farmerShare).toBeGreaterThan(split.platformFee);
    expect(split.farmerShare).toBeGreaterThan(split.deliveryFee);
  });
});

describe('calculateDriverPayout', () => {
  it('driver receives full 5% delivery fee aggregate', () => {
    const deliveries = [
      { subtotal: 50.00 },
      { subtotal: 75.00 },
    ];
    expect(calculateDriverPayout(deliveries)).toBe(6.25); // (50+75)*0.05
  });

  it('handles single delivery', () => {
    expect(calculateDriverPayout([{ subtotal: 100.00 }])).toBe(5.00);
    expect(calculateDriverPayout([{ subtotal: 40.00 }])).toBe(2.00);
  });

  it('handles empty batch', () => {
    expect(calculateDriverPayout([])).toBe(0);
  });

  it('calculates payout for multiple deliveries accurately', () => {
    const deliveries = [
      { subtotal: 25.00 },  // $1.25 fee
      { subtotal: 50.00 },  // $2.50 fee
      { subtotal: 75.00 },  // $3.75 fee
      { subtotal: 100.00 }, // $5.00 fee
    ];
    // Total: $12.50
    expect(calculateDriverPayout(deliveries)).toBe(12.50);
  });

  it('rounds final payout to 2 decimals', () => {
    const deliveries = [
      { subtotal: 33.33 }, // $1.67 fee
      { subtotal: 33.33 }, // $1.67 fee
      { subtotal: 33.34 }, // $1.67 fee
    ];
    // Total: $5.01 (rounded)
    expect(calculateDriverPayout(deliveries)).toBe(5.01);
  });

  it('handles small order amounts', () => {
    const deliveries = [
      { subtotal: 1.00 },
      { subtotal: 2.00 },
      { subtotal: 3.00 },
    ];
    expect(calculateDriverPayout(deliveries)).toBe(0.30); // (1+2+3)*0.05
  });
});
