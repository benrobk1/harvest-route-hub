/**
 * CLAIM ROUTE EDGE FUNCTION
 * Allows drivers to claim available delivery batches
 * 
 * Middleware Pattern:
 * - Request ID logging
 * - Authentication
 * - Driver role verification
 * - Rate limiting
 * - Input validation
 * - Atomic batch claiming logic
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { ClaimRouteRequestSchema } from '../_shared/contracts/index.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

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
  console.log(`[${requestId}] [CLAIM-ROUTE] Request started`);

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

    // DRIVER ROLE CHECK
    const { data: isDriver, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'driver',
    });

    if (roleErr || !isDriver) {
      console.warn(`[${requestId}] Driver role check failed for user ${user.id}`);
      return new Response(
        JSON.stringify({
          error: 'DRIVER_ROLE_REQUIRED',
          message: 'Driver role required to access this resource',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RATE LIMITING
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.CLAIM_ROUTE);
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
    const validation = ClaimRouteRequestSchema.safeParse(body);

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

    // BUSINESS LOGIC - Atomic batch claiming
    console.log(`[${requestId}] Driver ${user.id} claiming batch ${input.batch_id}`);

    // Check batch availability
    const { data: batch, error: loadErr } = await supabase
      .from('delivery_batches')
      .select('id, status, driver_id')
      .eq('id', input.batch_id)
      .single();

    if (loadErr || !batch) {
      console.warn(`[${requestId}] Batch not found: ${input.batch_id}`);
      return new Response(
        JSON.stringify({
          error: 'BATCH_NOT_FOUND',
          message: 'Batch not found',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (batch.status !== 'pending' || batch.driver_id !== null) {
      console.warn(`[${requestId}] Batch unavailable: status=${batch.status}, driver=${batch.driver_id}`);
      return new Response(
        JSON.stringify({
          error: 'BATCH_UNAVAILABLE',
          message: 'Batch is not available for claiming',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign batch to driver
    const { error: updateErr } = await supabase
      .from('delivery_batches')
      .update({ driver_id: user.id, status: 'assigned' })
      .eq('id', input.batch_id);

    if (updateErr) {
      console.error(`[${requestId}] Failed to assign batch:`, updateErr);
      throw new Error(`Failed to assign batch: ${updateErr.message}`);
    }

    console.log(`[${requestId}] ✅ Batch ${input.batch_id} assigned to driver ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error(`[claim-route] Error:`, error);
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
