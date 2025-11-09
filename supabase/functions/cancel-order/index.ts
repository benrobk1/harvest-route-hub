/**
 * CANCEL ORDER EDGE FUNCTION
 * Cancels orders with inventory restoration and cleanup
 * 
 * Middleware Pattern:
 * - Request ID logging
 * - Authentication
 * - Rate limiting
 * - Input validation
 * - Service layer for complex cancellation logic
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { CancelOrderRequestSchema } from '../_shared/contracts/index.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { OrderCancellationService } from '../_shared/services/OrderCancellationService.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // REQUEST ID - Correlation for logs
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [CANCEL-ORDER] Request started`);

  try {
    // CONFIG LOADING
    const config = loadConfig();
    const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

    // AUTHENTICATION
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] Missing authorization header`);
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error(`[${requestId}] Authentication failed:`, authError?.message);
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${requestId}] Authenticated user: ${user.id}`);

    // RATE LIMITING
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.CANCEL_ORDER);
    if (!rateCheck.allowed) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
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
          },
        }
      );
    }

    // INPUT VALIDATION
    const body = await req.json();
    const validation = CancelOrderRequestSchema.safeParse(body);

    if (!validation.success) {
      console.warn(`[${requestId}] Validation failed:`, validation.error.flatten());
      return new Response(
        JSON.stringify({
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validation.error.flatten(),
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const input = validation.data;

    // BUSINESS LOGIC - Service layer
    console.log(`[${requestId}] Cancelling order ${input.orderId} for user ${user.id}`);
    const cancellationService = new OrderCancellationService(supabase);

    try {
      await cancellationService.cancelOrder(input.orderId, user.id);
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';

      // Map service errors to HTTP responses
      if (errorMessage.includes('ORDER_NOT_FOUND')) {
        return new Response(
          JSON.stringify({
            error: 'ORDER_NOT_FOUND',
            message: 'Order not found',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (errorMessage.includes('INVALID_STATUS')) {
        return new Response(
          JSON.stringify({
            error: 'INVALID_STATUS',
            message: errorMessage.split(': ')[1] || 'Cannot cancel order with current status',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (errorMessage.includes('TOO_LATE_TO_CANCEL')) {
        return new Response(
          JSON.stringify({
            error: 'TOO_LATE_TO_CANCEL',
            message: 'Cannot cancel orders within 24 hours of delivery',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Re-throw other errors
      throw error;
    }

    console.log(`[${requestId}] ✅ Order ${input.orderId} cancelled successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Order cancelled and deleted successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error(`[cancel-order] Error:`, error);
    return new Response(
      JSON.stringify({
        error: 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
