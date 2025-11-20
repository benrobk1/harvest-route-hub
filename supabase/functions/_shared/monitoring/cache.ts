/**
 * SIMPLE IN-MEMORY CACHE
 * 
 * Provides TTL-based caching for edge functions to reduce:
 * - Redundant database queries
 * - External API calls (geocoding, OSRM)
 * - Expensive computations
 * 
 * Note: Cache is per-instance and resets when function cold-starts
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) {
    this.defaultTTL = defaultTTLSeconds * 1000; // Convert to ms
  }

  /**
   * Get cached value if not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Set cache value with TTL
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
    const expiresAt = Date.now() + ttl;
    
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Decorator to cache function results
 */
export function cached<T, TArgs extends unknown[]>(
  cache: SimpleCache<T>,
  keyFn: (...args: TArgs) => string,
  ttlSeconds?: number
) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => Promise<T> | T>
  ) {
    const originalMethod = descriptor.value;

    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = async function (...args: TArgs) {
      const cacheKey = keyFn(...args);

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        console.log(`[CACHE] Hit: ${propertyKey} (${cacheKey})`);
        return cached;
      }

      // Execute and cache
      console.log(`[CACHE] Miss: ${propertyKey} (${cacheKey})`);
      const result = await originalMethod.apply(this, args);
      cache.set(cacheKey, result, ttlSeconds);

      return result;
    };

    return descriptor;
  };
}

// Global cache instances for different use cases
export const marketConfigCache = new SimpleCache<unknown>(600); // 10 minutes
export const geocodeCache = new SimpleCache<unknown>(3600); // 1 hour
export const osrmCache = new SimpleCache<unknown>(1800); // 30 minutes
export const userProfileCache = new SimpleCache<unknown>(300); // 5 minutes
