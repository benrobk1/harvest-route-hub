import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import {
  createMiddlewareStack,
  withAuth,
  withCORS,
  withErrorHandling,
  withRequestId,
  withSupabaseServiceRole,
  withValidation,
} from "../_shared/middleware/index.ts";
import type { AuthContext } from "../_shared/middleware/withAuth.ts";
import type { CORSContext } from "../_shared/middleware/withCORS.ts";
import type { RequestIdContext } from "../_shared/middleware/withRequestId.ts";
import type { ValidationContext } from "../_shared/middleware/withValidation.ts";
import type { SupabaseServiceRoleContext } from "../_shared/middleware/withSupabaseServiceRole.ts";

const ClaimRouteSchema = z.object({
  batch_id: z.string().uuid({ message: "batch_id must be a valid UUID" }),
});

type ClaimRouteInput = z.infer<typeof ClaimRouteSchema>;

interface ClaimRouteContext
  extends RequestIdContext,
    CORSContext,
    AuthContext,
    ValidationContext<ClaimRouteInput>,
    SupabaseServiceRoleContext {}

const stack = createMiddlewareStack<ClaimRouteContext>([
  withErrorHandling,
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withValidation(ClaimRouteSchema),
]);

const handler = stack(async (_req, ctx) => {
  const { supabase, corsHeaders, requestId, user, input } = ctx;
  const { batch_id } = input;

  console.log(
    `[${requestId}] [CLAIM-ROUTE] Driver attempting to claim batch`,
    { userId: user.id, batchId: batch_id },
  );

  const { data: isDriver, error: roleError } = await supabase.rpc("has_role", {
    _user_id: user.id,
    _role: "driver",
  });

  if (roleError) {
    console.error(`[${requestId}] [CLAIM-ROUTE] Role check failed`, roleError);
    throw roleError;
  }

  if (!isDriver) {
    console.warn(
      `[${requestId}] [CLAIM-ROUTE] User lacks driver role`,
      { userId: user.id },
    );

    return new Response(
      JSON.stringify({ error: "Driver role required" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: batch, error: batchError } = await supabase
    .from("delivery_batches")
    .select("id, status, driver_id")
    .eq("id", batch_id)
    .maybeSingle();

  if (batchError) {
    console.error(`[${requestId}] [CLAIM-ROUTE] Failed to load batch`, batchError);
    throw batchError;
  }

  if (!batch) {
    return new Response(
      JSON.stringify({ error: "Batch not found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (batch.status !== "pending" || batch.driver_id !== null) {
    console.warn(
      `[${requestId}] [CLAIM-ROUTE] Batch unavailable`,
      { status: batch.status, driverId: batch.driver_id },
    );

    return new Response(
      JSON.stringify({ error: "Batch not available" }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { error: updateError } = await supabase
    .from("delivery_batches")
    .update({ driver_id: user.id, status: "assigned" })
    .eq("id", batch_id);

  if (updateError) {
    console.error(
      `[${requestId}] [CLAIM-ROUTE] Failed to assign batch`,
      updateError,
    );
    throw updateError;
  }

  console.log(
    `[${requestId}] [CLAIM-ROUTE] Batch successfully claimed`,
    { userId: user.id, batchId: batch_id },
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

serve((req) => {
  const initialContext: Partial<ClaimRouteContext> = {};

  return handler(req, initialContext);
});
