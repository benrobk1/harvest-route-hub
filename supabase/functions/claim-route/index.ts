/**
 * CLAIM ROUTE EDGE FUNCTION
 * Allows drivers to claim available delivery batches
 * 
 * Full Middleware Pattern:
 * RequestId + CORS + Auth + DriverAuth + RateLimit + Validation + ErrorHandling
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadConfig } from '../_shared/config.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { ClaimRouteRequestSchema } from '../_shared/contracts/index.ts';
import {
  withRequestId,
  withCORS,
  withAuth,
  withDriverAuth,
  withRateLimit,
  withValidation,
  withErrorHandling,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
} from '../_shared/middleware/index.ts';

type ClaimRouteInput = {
  batch_id: string;
};

type Context = RequestIdContext & CORSContext & AuthContext & ValidationContext<ClaimRouteInput>;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, user, input } = ctx;
  
  const config = loadConfig();
  const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);

  console.log(`[${requestId}] Driver ${user.id} claiming batch ${input.batch_id}`);

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
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withAuth,
  withDriverAuth,
  withRateLimit(RATE_LIMITS.CLAIM_ROUTE),
  withValidation(ClaimRouteRequestSchema),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
