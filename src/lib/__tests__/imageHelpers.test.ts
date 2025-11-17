import { describe, it, expect } from 'vitest';
import { preloadImage, getImagePlaceholder, isValidImageUrl } from '../imageHelpers';

describe('preloadImage', () => {
  it('resolves when image loads successfully', async () => {
    await expect(preloadImage('https://example.com/image.jpg')).resolves.toBeUndefined();
  });

  it('rejects when image fails to load', async () => {
    await expect(preloadImage('invalid-url')).rejects.toThrow();
  });
});

describe('getImagePlaceholder', () => {
  it('returns SVG data URL', () => {
    const placeholder = getImagePlaceholder('https://example.com/image.jpg');
    expect(placeholder).toMatch(/^data:image\/svg\+xml/);
  });

  it('returns same placeholder for any input', () => {
    const placeholder1 = getImagePlaceholder('url1');
    const placeholder2 = getImagePlaceholder('url2');
    expect(placeholder1).toBe(placeholder2);
  });

  it('returns placeholder for null input', () => {
    const placeholder = getImagePlaceholder(null);
    expect(placeholder).toMatch(/^data:image\/svg\+xml/);
  });
});

describe('isValidImageUrl', () => {
  it('returns true for valid HTTP URLs', () => {
    expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
    expect(isValidImageUrl('http://example.com/image.png')).toBe(true);
  });

  it('returns true for data URLs', () => {
    expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(true);
  });

  it('returns false for invalid URLs', () => {
    expect(isValidImageUrl('not-a-url')).toBe(false);
    expect(isValidImageUrl('//relative-url')).toBe(false);
  });

  it('returns false for null or empty', () => {
    expect(isValidImageUrl(null)).toBe(false);
    expect(isValidImageUrl('')).toBe(false);
  });

  it('returns true for Supabase storage URLs', () => {
    expect(isValidImageUrl('https://xushmvtkfkijrhfoxhat.supabase.co/storage/v1/object/public/images/test.jpg')).toBe(true);
  });
});
