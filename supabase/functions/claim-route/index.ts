/**
 * CLAIM ROUTE EDGE FUNCTION
 * Allows drivers to claim available delivery batches
 * 
 * Full Middleware Pattern:
 * RequestId + CORS + Auth + DriverAuth + RateLimit + Validation + ErrorHandling
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
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
  withSupabaseServiceRole,
  createMiddlewareStack,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
  type SupabaseServiceRoleContext,
} from '../_shared/middleware/index.ts';

type ClaimRouteInput = {
  batch_id: string;
};

type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  ValidationContext<ClaimRouteInput> &
  SupabaseServiceRoleContext;

const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, user, input, supabase } = ctx;

  console.log(`[${requestId}] Driver ${user.id} claiming batch ${input.batch_id}`);

    // ATOMIC OPERATION: Use UPDATE with WHERE conditions to prevent race condition
    // This ensures only one driver can successfully claim a batch
    const { data: updatedBatch, error: updateErr } = await supabase
      .from('delivery_batches')
      .update({ driver_id: user.id, status: 'assigned' })
      .eq('id', input.batch_id)
      .eq('status', 'pending')        // Only update if still pending
      .is('driver_id', null)           // Only update if no driver assigned
      .select()
      .single();

    if (updateErr) {
      // Check if it's a "no rows returned" error (batch was already claimed)
      if (updateErr.code === 'PGRST116') {
        console.warn(`[${requestId}] Batch ${input.batch_id} already claimed or not available`);
        return new Response(
          JSON.stringify({
            error: 'BATCH_UNAVAILABLE',
            message: 'Batch is not available for claiming',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.error(`[${requestId}] Failed to assign batch:`, updateErr);
      throw new Error(`Failed to assign batch: ${updateErr.message}`);
    }

    if (!updatedBatch) {
      console.warn(`[${requestId}] Batch ${input.batch_id} not found`);
      return new Response(
        JSON.stringify({
          error: 'BATCH_NOT_FOUND',
          message: 'Batch not found',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
  withSupabaseServiceRole,
  withAuth,
  withDriverAuth,
  withRateLimit(RATE_LIMITS.CLAIM_ROUTE),
  withValidation(ClaimRouteRequestSchema),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
