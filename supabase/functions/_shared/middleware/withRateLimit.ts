import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, RateLimitConfig } from '../rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface RateLimitContext {
  user: { id: string };
  supabase: SupabaseClient;
}

/**
 * Rate Limiting Middleware Factory (Curried)
 * Applies rate limiting per user
 * Returns 429 if rate limit exceeded
 * 
 * @example
 * const handler = withRateLimit(RATE_LIMITS.CHECKOUT)(async (req, ctx) => {
 *   return new Response('OK');
 * });
 */
export const withRateLimit = <T extends RateLimitContext>(
  config: RateLimitConfig
) => {
  return (
    handler: (req: Request, ctx: T) => Promise<Response>
  ): ((req: Request, ctx: T) => Promise<Response>) => {
    return async (req: Request, ctx: T): Promise<Response> => {
      // Skip rate limiting for OPTIONS preflight requests
      if (req.method === 'OPTIONS') {
        return handler(req, ctx);
      }
      
      const { user, supabase } = ctx;

      // Check rate limit
      const rateCheck = await checkRateLimit(supabase, user.id, config);

      if (!rateCheck.allowed) {
        console.warn(`Rate limit exceeded for user ${user.id} on ${config.keyPrefix}`);
        return new Response(
          JSON.stringify({ 
            error: 'TOO_MANY_REQUESTS', 
            message: 'Too many requests. Please try again later.',
            retryAfter: rateCheck.retryAfter,
          }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(rateCheck.retryAfter || 60),
            } 
          }
        );
      }

      return handler(req, ctx);
    };
  };
};
