import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isCutoffPassed, getNextAvailableDate } from '../marketHelpers';

describe('isCutoffPassed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when current time is past cutoff', () => {
    vi.setSystemTime(new Date('2024-01-15T15:00:00'));
    expect(isCutoffPassed('14:00')).toBe(true);
  });

  it('returns false when current time is before cutoff', () => {
    vi.setSystemTime(new Date('2024-01-15T13:00:00'));
    expect(isCutoffPassed('14:00')).toBe(false);
  });

  it('returns true when exactly at cutoff time', () => {
    vi.setSystemTime(new Date('2024-01-15T14:00:00'));
    expect(isCutoffPassed('14:00')).toBe(true);
  });

  it('handles different cutoff times', () => {
    vi.setSystemTime(new Date('2024-01-15T10:30:00'));
    expect(isCutoffPassed('09:00')).toBe(true);
    expect(isCutoffPassed('11:00')).toBe(false);
  });
});

describe('getNextAvailableDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns next delivery day after cutoff', () => {
    // Monday at 3 PM, cutoff at 2 PM
    vi.setSystemTime(new Date('2024-01-15T15:00:00')); // Monday
    const deliveryDays = ['Wednesday', 'Friday'];
    const nextDate = getNextAvailableDate('14:00', deliveryDays);
    
    expect(nextDate.toLocaleDateString('en-US', { weekday: 'long' })).toBe('Wednesday');
  });

  it('returns tomorrow if before cutoff and tomorrow is delivery day', () => {
    // Monday at 1 PM, cutoff at 2 PM, Tuesday is delivery day
    vi.setSystemTime(new Date('2024-01-15T13:00:00')); // Monday
    const deliveryDays = ['Tuesday', 'Thursday'];
    const nextDate = getNextAvailableDate('14:00', deliveryDays);
    
    expect(nextDate.toLocaleDateString('en-US', { weekday: 'long' })).toBe('Tuesday');
  });

  it('skips to next available delivery day', () => {
    // Monday after cutoff, next delivery is Friday
    vi.setSystemTime(new Date('2024-01-15T15:00:00')); // Monday
    const deliveryDays = ['Friday'];
    const nextDate = getNextAvailableDate('14:00', deliveryDays);
    
    expect(nextDate.toLocaleDateString('en-US', { weekday: 'long' })).toBe('Friday');
  });

  it('handles weekly recurring delivery days', () => {
    vi.setSystemTime(new Date('2024-01-15T15:00:00')); // Monday
    const deliveryDays = ['Monday'];
    const nextDate = getNextAvailableDate('14:00', deliveryDays);
    
    // Should return next Monday (a week later)
    const daysDiff = Math.floor((nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBeGreaterThan(6);
  });
});
