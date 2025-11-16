import { describe, it, expect } from 'vitest';
import { shouldShowRating, getRatingDisplay, MINIMUM_REVIEWS_THRESHOLD } from '../ratingHelpers';

describe('shouldShowRating', () => {
  it('returns true when review count meets threshold', () => {
    expect(shouldShowRating(25)).toBe(true);
    expect(shouldShowRating(30)).toBe(true);
    expect(shouldShowRating(100)).toBe(true);
  });

  it('returns false when review count below threshold', () => {
    expect(shouldShowRating(24)).toBe(false);
    expect(shouldShowRating(10)).toBe(false);
    expect(shouldShowRating(0)).toBe(false);
  });

  it('uses correct threshold constant', () => {
    expect(MINIMUM_REVIEWS_THRESHOLD).toBe(25);
  });
});

describe('getRatingDisplay', () => {
  it('shows rating when threshold met', () => {
    const result = getRatingDisplay(4.5, 30);
    expect(result.rating).toBe('4.5');
    expect(result.reviewCount).toBe(30);
    expect(result.show).toBe(true);
    expect(result.progress).toBeUndefined();
  });

  it('hides rating and shows progress when below threshold', () => {
    const result = getRatingDisplay(4.5, 10);
    expect(result.rating).toBe('N/A');
    expect(result.reviewCount).toBe(10);
    expect(result.show).toBe(false);
    expect(result.progress).toBe('10/25');
  });

  it('formats rating to 1 decimal place', () => {
    expect(getRatingDisplay(4.567, 30).rating).toBe('4.6');
    expect(getRatingDisplay(3.0, 30).rating).toBe('3.0');
  });

  it('handles exactly at threshold', () => {
    const result = getRatingDisplay(4.8, 25);
    expect(result.show).toBe(true);
    expect(result.rating).toBe('4.8');
  });

  it('handles zero reviews', () => {
    const result = getRatingDisplay(0, 0);
    expect(result.show).toBe(false);
    expect(result.rating).toBe('N/A');
    expect(result.progress).toBe('0/25');
  });
});
