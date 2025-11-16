import { describe, it, expect } from 'vitest';
import { calculateDistance, parseLocation, getZipCodeCoordinates, calculateFarmToConsumerDistance } from '../distanceHelpers';

describe('calculateDistance', () => {
  it('calculates distance between two points correctly', () => {
    // NYC to Boston (approx 190 miles)
    const distance = calculateDistance(40.7128, -74.0060, 42.3601, -71.0589);
    expect(distance).toBeCloseTo(190, 0);
  });

  it('returns 0 for same location', () => {
    const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
    expect(distance).toBe(0);
  });

  it('calculates short distances accurately', () => {
    // Two points about 1 mile apart in NYC
    const distance = calculateDistance(40.7580, -73.9855, 40.7489, -73.9680);
    expect(distance).toBeCloseTo(1, 0);
  });
});

describe('parseLocation', () => {
  it('parses valid location string', () => {
    const result = parseLocation('40.7128,-74.0060');
    expect(result).toEqual({ lat: 40.7128, lng: -74.0060 });
  });

  it('returns null for invalid format', () => {
    expect(parseLocation('invalid')).toBeNull();
    expect(parseLocation('40.7128')).toBeNull();
    expect(parseLocation('')).toBeNull();
  });

  it('handles whitespace', () => {
    const result = parseLocation(' 40.7128 , -74.0060 ');
    expect(result).toEqual({ lat: 40.7128, lng: -74.0060 });
  });

  it('returns null for non-numeric values', () => {
    expect(parseLocation('abc,def')).toBeNull();
  });
});

describe('getZipCodeCoordinates', () => {
  it('returns coordinates for known ZIP codes', () => {
    const coords = getZipCodeCoordinates('10001');
    expect(coords).toBeDefined();
    expect(coords?.lat).toBeCloseTo(40.75, 0);
    expect(coords?.lng).toBeCloseTo(-73.99, 0);
  });

  it('returns null for unknown ZIP codes', () => {
    expect(getZipCodeCoordinates('99999')).toBeNull();
  });

  it('returns null for invalid ZIP codes', () => {
    expect(getZipCodeCoordinates('abc')).toBeNull();
    expect(getZipCodeCoordinates('')).toBeNull();
  });
});

describe('calculateFarmToConsumerDistance', () => {
  it('calculates distance when both coordinates are valid', () => {
    const distance = calculateFarmToConsumerDistance('40.7580,-73.9855', '10001');
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(5);
  });

  it('returns null when farm location is invalid', () => {
    expect(calculateFarmToConsumerDistance('invalid', '10001')).toBeNull();
  });

  it('returns null when consumer ZIP is unknown', () => {
    expect(calculateFarmToConsumerDistance('40.7580,-73.9855', '99999')).toBeNull();
  });

  it('returns null when both are invalid', () => {
    expect(calculateFarmToConsumerDistance('invalid', '99999')).toBeNull();
  });
});
