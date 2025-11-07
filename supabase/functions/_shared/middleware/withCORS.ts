/**
 * CORS Middleware
 * Validates origin and returns appropriate CORS headers
 * Restricts sensitive endpoints to allowed origins only
 */

const ALLOWED_ORIGINS = new Set([
  'https://lovable.app',
  'http://localhost:5173',
  'http://localhost:3000',
]);

export interface CORSContext {
  corsHeaders: Record<string, string>;
}

export function validateOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin') ?? '';
  
  // Allow requests without Origin header (e.g., from server-side)
  if (!origin) {
    return 'https://lovable.app';
  }
  
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin) {
    // Fallback to primary domain if origin not in allowlist
    return {
      'Access-Control-Allow-Origin': 'https://lovable.app',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * CORS Middleware (Curried)
 * Validates origin and attaches CORS headers
 * Returns 403 for requests from non-allowed origins
 * 
 * @example
 * const handler = withCORS(async (req, ctx) => {
 *   return new Response('OK', { headers: ctx.corsHeaders });
 * });
 */
export const withCORS = <T extends CORSContext>(
  handler: (req: Request, ctx: T) => Promise<Response>
): ((req: Request, ctx: Partial<T>) => Promise<Response>) => {
  return async (req: Request, ctx: Partial<T>): Promise<Response> => {
    const origin = validateOrigin(req);
    
    if (!origin) {
      const requestOrigin = req.headers.get('Origin') ?? 'unknown';
      console.warn(`Blocked request from non-allowed origin: ${requestOrigin}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'FORBIDDEN',
          message: 'Origin not allowed',
        }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const corsHeaders = getCorsHeaders(origin);
    
    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Attach CORS headers to context
    const corsContext = {
      ...ctx,
      corsHeaders,
    } as T;

    return handler(req, corsContext);
  };
};
