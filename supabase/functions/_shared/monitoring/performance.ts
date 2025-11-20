/**
 * PERFORMANCE UTILITIES
 * 
 * Helper functions for performance optimization:
 * - Query batching
 * - Parallel execution
 * - Performance profiling
 */

/**
 * Batch multiple database queries and execute in parallel
 */
export async function batchQueries<T>(
  queries: Array<Promise<T>>
): Promise<T[]> {
  const start = Date.now();
  
  try {
    const results = await Promise.all(queries);
    const duration = Date.now() - start;
    
    console.log(`[PERF] Batch of ${queries.length} queries completed in ${duration}ms`);
    return results;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[PERF] Batch query failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Execute function with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.log(`[PERF] Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Measure function execution time
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    console.log(`[PERF] ${name}: ${duration}ms`);
    
    if (duration > 1000) {
      console.warn(`[PERF] ⚠️ Slow operation: ${name} took ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[PERF] ${name} failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Chunk array into smaller batches for processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Process array in parallel with concurrency limit
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const chunks = chunkArray(items, concurrency);
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processFn));
    results.push(...chunkResults);
  }
  
  return results;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastCall >= limitMs) {
      fn(...args);
      lastCall = now;
    }
  };
}
