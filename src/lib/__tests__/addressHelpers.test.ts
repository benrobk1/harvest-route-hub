import { describe, it, expect } from 'vitest';
import { formatFullAddress, formatShortAddress, parseAddress } from '../addressHelpers';

describe('formatFullAddress', () => {
  it('formats complete address correctly', () => {
    const address = {
      street_address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip_code: '62701',
    };
    expect(formatFullAddress(address)).toBe('123 Main St, Springfield, IL 62701');
  });

  it('handles addresses with country', () => {
    const address = {
      street_address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip_code: '62701',
      country: 'USA',
    };
    expect(formatFullAddress(address)).toBe('123 Main St, Springfield, IL 62701');
  });

  it('filters out falsy values', () => {
    const address = {
      street_address: '123 Main St',
      city: '',
      state: 'IL',
      zip_code: '62701',
    };
    expect(formatFullAddress(address)).toBe('123 Main St, IL 62701');
  });
});

describe('formatShortAddress', () => {
  it('formats short address correctly', () => {
    const address = {
      street_address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip_code: '62701',
    };
    expect(formatShortAddress(address)).toBe('Springfield, IL 62701');
  });
});

describe('parseAddress', () => {
  it('parses complete address string', () => {
    const result = parseAddress('123 Main St, Springfield, IL 62701');
    expect(result).toEqual({
      street_address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zip_code: '62701',
    });
  });

  it('handles empty string', () => {
    expect(parseAddress('')).toEqual({});
  });

  it('handles incomplete address with only street', () => {
    const result = parseAddress('123 Main St');
    expect(result).toEqual({
      street_address: '123 Main St',
    });
  });

  it('handles address without state/zip match', () => {
    const result = parseAddress('123 Main St, Springfield');
    expect(result).toEqual({
      street_address: '123 Main St',
      city: 'Springfield',
      state: '',
      zip_code: '',
    });
  });

  it('extracts state and ZIP correctly', () => {
    const result = parseAddress('456 Oak Ave, Portland, OR 97201');
    expect(result.state).toBe('OR');
    expect(result.zip_code).toBe('97201');
  });
});
