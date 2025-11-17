import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import {
  withRequestId,
  withCORS,
  withAdminAuth,
  withRateLimit,
  withErrorHandling,
  withMetrics,
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type MetricsContext,
  type SupabaseServiceRoleContext
} from '../_shared/middleware/index.ts';
import {
  rotateAPIKey,
  expireOldKeys,
  getKeyRotationStatus,
  checkKeyRotationNeeded
} from '../_shared/security/apiKeyRotation.ts';

/**
 * ROTATE API KEYS EDGE FUNCTION
 * 
 * Admin-only endpoint for managing API key rotation.
 * Supports rotation, expiration, and status checking.
 */

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  MetricsContext &
  SupabaseServiceRoleContext;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  ctx.metrics.mark('api_key_rotation_started');
  
  const { config, supabase } = ctx;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'status';

  console.log(`[${ctx.requestId}] API Key Rotation - Action: ${action}`);

  // Handle different actions
  switch (action) {
    case 'status': {
      const status = await getKeyRotationStatus(supabase);
      const needsRotation = await checkKeyRotationNeeded(supabase);
      
      return new Response(JSON.stringify({
        success: true,
        keys: status,
        needs_rotation: needsRotation,
        recommendation: needsRotation.length > 0 
          ? `Services requiring rotation: ${needsRotation.join(', ')}`
          : 'All keys are current'
      }), {
        headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    case 'rotate': {
      if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      const { service, newKey, transitionDays } = await req.json();
      
      if (!service || !newKey) {
        return new Response(
          JSON.stringify({ error: 'Missing service or newKey' }),
          { status: 400 }
        );
      }

      const result = await rotateAPIKey(
        supabase, 
        service, 
        newKey, 
        transitionDays || 7
      );

      return new Response(JSON.stringify(result), {
        headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400
      });
    }

    case 'expire': {
      const expiredCount = await expireOldKeys(supabase);
      
      return new Response(JSON.stringify({
        success: true,
        expired_count: expiredCount,
        message: `${expiredCount} keys expired`
      }), {
        headers: { ...ctx.corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    default:
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use: status, rotate, or expire' }),
        { status: 400 }
      );
  }
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAdminAuth,
  withRateLimit(RATE_LIMITS.CHECK_SUBSCRIPTION),
  withMetrics('rotate-api-keys'),
  withErrorHandling
]);

serve((req) => middlewareStack(handler)(req, {} as any));
