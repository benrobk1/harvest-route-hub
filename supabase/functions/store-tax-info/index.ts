/**
 * STORE TAX INFO EDGE FUNCTION
 * Securely stores encrypted tax information (EIN/SSN) for users
 * 
 * Middleware Pattern:
 * - Request ID logging
 * - Authentication
 * - Rate limiting
 * - Input validation
 * - Service layer for business logic
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { StoreTaxInfoRequestSchema } from '../_shared/contracts/index.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { TaxInfoService } from '../_shared/services/TaxInfoService.ts';

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
  console.log(`[${requestId}] [STORE-TAX-INFO] Request started`);

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
    const rateCheck = await checkRateLimit(supabase, user.id, RATE_LIMITS.TAX_INFO);
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
    const validation = StoreTaxInfoRequestSchema.safeParse(body);

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

    // BUSINESS LOGIC
    console.log(`[${requestId}] Storing tax info for user ${user.id}`);
    const taxInfoService = new TaxInfoService(supabase, config);

    await taxInfoService.storeTaxInfo(
      user.id,
      input.tax_id,
      input.tax_id_type,
      input.tax_name,
      input.tax_address
    );

    console.log(`[${requestId}] ✅ Tax info securely stored`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error(`[store-tax-info] Error:`, error);
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
