/**
 * Image helper utilities for performance optimization
 */

/**
 * Preload an image for better performance
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Get a placeholder for an image (can be enhanced with blurhash in the future)
 */
export const getImagePlaceholder = (url: string | null): string => {
  const hasValue = Boolean(url);
  const fillColor = hasValue ? '%23e8e8e8' : '%23f0f0f0';

  return `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="${fillColor}"/%3E%3C/svg%3E`;
};

/**
 * Check if an image URL is valid
 */
export const isValidImageUrl = (url: string | null): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
