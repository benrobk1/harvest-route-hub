import { describe, it, expect } from 'vitest';
import {
  calculateCreditsEarned,
  applyCreditsDiscount,
  calculateSubscriptionBonus,
  calculateAvailableNextMonth,
} from '../creditsHelpers';

describe('calculateCreditsEarned', () => {
  it('accrues 1 credit per $100 spent', () => {
    expect(calculateCreditsEarned(250.00)).toBe(2);
    expect(calculateCreditsEarned(100.00)).toBe(1);
    expect(calculateCreditsEarned(300.00)).toBe(3);
  });

  it('rounds down partial credits', () => {
    expect(calculateCreditsEarned(199.99)).toBe(1);
    expect(calculateCreditsEarned(99.99)).toBe(0);
    expect(calculateCreditsEarned(150.50)).toBe(1);
  });

  it('handles zero and negative amounts', () => {
    expect(calculateCreditsEarned(0)).toBe(0);
    expect(calculateCreditsEarned(-50)).toBe(0);
  });

  it('handles large amounts correctly', () => {
    expect(calculateCreditsEarned(1000.00)).toBe(10);
    expect(calculateCreditsEarned(999.99)).toBe(9);
  });
});

describe('applyCreditsDiscount', () => {
  it('applies 1 credit as $10 discount', () => {
    expect(applyCreditsDiscount(50.00, 2)).toBe(30.00); // $50 - $20
    expect(applyCreditsDiscount(100.00, 5)).toBe(50.00);
    expect(applyCreditsDiscount(40.00, 1)).toBe(30.00);
  });

  it('limits discount to order total (cannot go negative)', () => {
    expect(applyCreditsDiscount(15.00, 3)).toBe(0); // $15 - $30 = $0 (not negative)
    expect(applyCreditsDiscount(25.00, 5)).toBe(0); // $25 - $50 = $0
    expect(applyCreditsDiscount(10.00, 2)).toBe(0);
  });

  it('handles zero credits', () => {
    expect(applyCreditsDiscount(50.00, 0)).toBe(50.00);
    expect(applyCreditsDiscount(100.00, 0)).toBe(100.00);
  });

  it('handles exact credit match', () => {
    expect(applyCreditsDiscount(30.00, 3)).toBe(0); // Exact match: $30 - $30
    expect(applyCreditsDiscount(100.00, 10)).toBe(0);
  });
});

describe('calculateSubscriptionBonus', () => {
  it('grants $10 credit on orders $100+ with active subscription', () => {
    expect(calculateSubscriptionBonus(150.00, true)).toBe(10.00);
    expect(calculateSubscriptionBonus(100.00, true)).toBe(10.00);
    expect(calculateSubscriptionBonus(200.00, true)).toBe(10.00);
  });

  it('no bonus for orders < $100', () => {
    expect(calculateSubscriptionBonus(99.99, true)).toBe(0);
    expect(calculateSubscriptionBonus(50.00, true)).toBe(0);
    expect(calculateSubscriptionBonus(0, true)).toBe(0);
  });

  it('no bonus without active subscription', () => {
    expect(calculateSubscriptionBonus(150.00, false)).toBe(0);
    expect(calculateSubscriptionBonus(100.00, false)).toBe(0);
    expect(calculateSubscriptionBonus(200.00, false)).toBe(0);
  });

  it('requires both conditions for bonus', () => {
    // No subscription
    expect(calculateSubscriptionBonus(150.00, false)).toBe(0);
    // Order too small
    expect(calculateSubscriptionBonus(99.99, true)).toBe(0);
    // Both conditions met
    expect(calculateSubscriptionBonus(100.00, true)).toBe(10.00);
  });
});

describe('calculateAvailableNextMonth', () => {
  it('sums earned credits from current month', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const ledger = [
      { created_at: `${currentMonth}-05T10:00:00`, transaction_type: 'earned', amount: 10 },
      { created_at: `${currentMonth}-10T14:30:00`, transaction_type: 'earned', amount: 10 },
      { created_at: `${currentMonth}-15T09:00:00`, transaction_type: 'earned', amount: 10 },
    ];
    
    expect(calculateAvailableNextMonth(ledger)).toBe(30);
  });

  it('excludes spent credits', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const ledger = [
      { created_at: `${currentMonth}-05T10:00:00`, transaction_type: 'earned', amount: 10 },
      { created_at: `${currentMonth}-10T14:30:00`, transaction_type: 'spent', amount: -10 },
    ];
    
    expect(calculateAvailableNextMonth(ledger)).toBe(10); // Only earned
  });

  it('excludes previous month earnings', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString().slice(0, 7);
    
    const ledger = [
      { created_at: `${currentMonth}-05T10:00:00`, transaction_type: 'earned', amount: 10 },
      { created_at: `${lastMonth}-25T14:30:00`, transaction_type: 'earned', amount: 10 },
    ];
    
    expect(calculateAvailableNextMonth(ledger)).toBe(10); // Only current month
  });

  it('handles empty ledger', () => {
    expect(calculateAvailableNextMonth([])).toBe(0);
  });
});
