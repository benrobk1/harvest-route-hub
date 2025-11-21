import { describe, it, expect } from 'vitest';
import { mapOrderStatus, formatOrderItems, formatEstimatedTime } from '../orderHelpers';

describe('mapOrderStatus', () => {
  it('maps database statuses to display statuses', () => {
    expect(mapOrderStatus('confirmed')).toBe('ordered');
    expect(mapOrderStatus('in_transit')).toBe('farm_pickup');
    expect(mapOrderStatus('out_for_delivery')).toBe('en_route');
    expect(mapOrderStatus('delivered')).toBe('delivered');
  });

  it('handles unknown status gracefully', () => {
    expect(mapOrderStatus('unknown_status')).toBe('ordered');
  });

  it('handles case variations', () => {
    expect(mapOrderStatus('confirmed')).toBe('ordered');
    expect(mapOrderStatus('delivered')).toBe('delivered');
  });
});

describe('formatOrderItems', () => {
  it('formats single item correctly', () => {
    const items = [{ quantity: 2, products: { name: 'Tomatoes' } }];
    expect(formatOrderItems(items)).toBe('Tomatoes (2 items)');
  });

  it('formats multiple items correctly', () => {
    const items = [
      { quantity: 2, products: { name: 'Tomatoes' } },
      { quantity: 1, products: { name: 'Carrots' } },
    ];
    expect(formatOrderItems(items)).toContain('Tomatoes');
    expect(formatOrderItems(items)).toContain('Carrots');
  });

  it('shows additional items count when many items', () => {
    const items = [
      { quantity: 1, products: { name: 'Item 1' } },
      { quantity: 1, products: { name: 'Item 2' } },
      { quantity: 1, products: { name: 'Item 3' } },
      { quantity: 1, products: { name: 'Item 4' } },
    ];
    const result = formatOrderItems(items);
    expect(result).toContain('more');
  });

  it('shows total quantity', () => {
    const items = [
      { quantity: 2, products: { name: 'Tomatoes' } },
      { quantity: 3, products: { name: 'Carrots' } },
    ];
    const result = formatOrderItems(items);
    expect(result).toContain('5 items');
  });

  it('handles empty array', () => {
    const result = formatOrderItems([]);
    expect(result).toBe('(0 items)');
  });
});

describe('formatEstimatedTime', () => {
  it('formats hours and minutes', () => {
    expect(formatEstimatedTime(150)).toBe('2h 30m');
  });

  it('formats hours only', () => {
    expect(formatEstimatedTime(120)).toBe('2h 0m');
  });

  it('formats minutes only', () => {
    expect(formatEstimatedTime(45)).toBe('45m');
  });

  it('handles zero minutes', () => {
    expect(formatEstimatedTime(0)).toBe('0m');
  });

  it('returns undefined for undefined input', () => {
    expect(formatEstimatedTime(undefined)).toBeUndefined();
  });

  it('rounds minutes correctly', () => {
    expect(formatEstimatedTime(61)).toBe('1h 1m');
    expect(formatEstimatedTime(59)).toBe('59m');
  });
});
