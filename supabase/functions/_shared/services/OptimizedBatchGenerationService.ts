import { BatchGenerationService, RouteOptimizationResult, Stop } from './BatchGenerationService.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { geocodeCache, osrmCache } from '../monitoring/cache.ts';

/**
 * OPTIMIZED BATCH GENERATION SERVICE
 * 
 * Extends BatchGenerationService with performance optimizations:
 * - Caches geocoding results
 * - Caches OSRM distance matrices
 * - Batches multiple geocoding requests
 * - Reduces redundant calculations
 */

export class OptimizedBatchGenerationService extends BatchGenerationService {
  constructor(
    supabase: SupabaseClient,
    mapboxToken?: string,
    osrmServer: string = 'https://router.project-osrm.org'
  ) {
    super(supabase, mapboxToken, osrmServer);
  }

  /**
   * Cached geocoding with TTL
   */
  override async geocodeAddress(address: string, zipCode?: string): Promise<{ latitude: number; longitude: number } | null> {
    const cacheKey = `geocode:${address}:${zipCode || 'none'}`;
    
    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached !== null) {
      console.log(`[CACHE] Geocode hit: ${address}`);
      return cached;
    }
    
    // Call parent implementation
    const result = await super.geocodeAddress(address, zipCode);
    
    // Cache result for 1 hour
    if (result) {
      geocodeCache.set(cacheKey, result, 3600);
    }
    
    return result;
  }

  /**
   * Cached OSRM route optimization
   */
  override async optimizeRouteWithOsrm(stops: Stop[]): Promise<RouteOptimizationResult> {
    // Create cache key from stop coordinates
    const coordString = stops
      .filter(s => s.latitude && s.longitude)
      .map(s => `${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`)
      .join('|');
    
    const cacheKey = `osrm:route:${coordString}`;
    
    // Check cache
    const cached = osrmCache.get(cacheKey);
    if (cached !== null) {
      console.log(`[CACHE] OSRM route hit: ${stops.length} stops`);
      return cached;
    }
    
    // Call parent implementation
    const result = await super.optimizeRouteWithOsrm(stops);
    
    // Cache for 30 minutes
    if (result) {
      osrmCache.set(cacheKey, result, 1800);
    }
    
    return result;
  }

  /**
   * Batch geocode multiple addresses in parallel
   */
  async batchGeocodeAddresses(
    addresses: Array<{ address: string; zipCode?: string }>
  ): Promise<Array<{ latitude: number; longitude: number } | null>> {
    console.log(`[BATCH] Geocoding ${addresses.length} addresses in parallel...`);
    
    const start = Date.now();
    
    // Limit concurrency to avoid rate limits
    const BATCH_SIZE = 5;
    const results: Array<{ latitude: number; longitude: number } | null> = [];
    
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      const batch = addresses.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(({ address, zipCode }) => this.geocodeAddress(address, zipCode))
      );
      results.push(...batchResults);
    }
    
    const duration = Date.now() - start;
    console.log(`[BATCH] Geocoded ${addresses.length} addresses in ${duration}ms (avg: ${Math.round(duration / addresses.length)}ms per address)`);
    
    return results;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    geocode: { size: number };
    osrm: { size: number };
  } {
    return {
      geocode: { size: geocodeCache.size() },
      osrm: { size: osrmCache.size() }
    };
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    geocodeCache.clear();
    osrmCache.clear();
    console.log('[CACHE] All caches cleared');
  }
}
