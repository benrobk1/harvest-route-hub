import { describe, it, expect } from 'vitest';
import { mapOrderStatus, formatOrderItems, formatEstimatedTime } from '../orderHelpers';

describe('mapOrderStatus', () => {
  it('maps database statuses to display statuses', () => {
    expect(mapOrderStatus('pending')).toBe('pending');
    expect(mapOrderStatus('confirmed')).toBe('confirmed');
    expect(mapOrderStatus('in_transit')).toBe('in-transit');
    expect(mapOrderStatus('delivered')).toBe('delivered');
    expect(mapOrderStatus('cancelled')).toBe('cancelled');
  });

  it('handles unknown status gracefully', () => {
    expect(mapOrderStatus('unknown_status')).toBe('pending');
  });

  it('handles case variations', () => {
    expect(mapOrderStatus('PENDING')).toBe('pending');
    expect(mapOrderStatus('Delivered')).toBe('delivered');
  });
});

describe('formatOrderItems', () => {
  it('formats single item correctly', () => {
    const items = [{ name: 'Tomatoes', quantity: 2, unit: 'lb' }];
    expect(formatOrderItems(items)).toBe('Tomatoes (2)');
  });

  it('formats multiple items correctly', () => {
    const items = [
      { name: 'Tomatoes', quantity: 2, unit: 'lb' },
      { name: 'Carrots', quantity: 1, unit: 'bunch' },
    ];
    expect(formatOrderItems(items)).toContain('Tomatoes');
    expect(formatOrderItems(items)).toContain('Carrots');
  });

  it('shows additional items count when many items', () => {
    const items = [
      { name: 'Item 1', quantity: 1 },
      { name: 'Item 2', quantity: 1 },
      { name: 'Item 3', quantity: 1 },
      { name: 'Item 4', quantity: 1 },
    ];
    const result = formatOrderItems(items);
    expect(result).toContain('more');
  });

  it('shows total quantity', () => {
    const items = [
      { name: 'Tomatoes', quantity: 2 },
      { name: 'Carrots', quantity: 3 },
    ];
    const result = formatOrderItems(items);
    expect(result).toContain('5 items');
  });

  it('handles empty array', () => {
    expect(formatOrderItems([])).toBe('No items');
  });
});

describe('formatEstimatedTime', () => {
  it('formats hours and minutes', () => {
    expect(formatEstimatedTime(150)).toBe('2h 30m');
  });

  it('formats hours only', () => {
    expect(formatEstimatedTime(120)).toBe('2h');
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
