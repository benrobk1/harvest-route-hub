import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  userId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowStart = new Date(now - config.windowMs).toISOString();
  const key = `${config.keyPrefix}:${userId}`;

  // OPTIMIZED: Single atomic DB operation instead of 3 separate queries
  // Reduces load from 3 ops/request to 1 op/request (3x improvement)
  // Critical for 50k+ user scalability
  const { data, error } = await supabaseAdmin.rpc('check_and_record_rate_limit', {
    p_key: key,
    p_window_start: windowStart,
    p_max_requests: config.maxRequests,
  });

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true }; // Fail open on errors
  }

  const result = data?.[0];
  if (!result) {
    console.error('Rate limit function returned no data');
    return { allowed: true }; // Fail open
  }

  if (!result.allowed) {
    const oldestRequest = new Date(result.oldest_request_time).getTime();
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}
