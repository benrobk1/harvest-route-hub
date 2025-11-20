/**
 * STORE TAX INFO EDGE FUNCTION
 * Securely stores encrypted tax information (EIN/SSN) for users
 * 
 * Middleware Stack:
 * 1. Request ID (correlation logging)
 * 2. CORS (origin validation)
 * 3. Authentication (JWT validation)
 * 4. Rate Limiting (per-user limits)
 * 5. Validation (Zod schema)
 * 6. Error Handling (standardized responses)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';
import { StoreTaxInfoRequestSchema, type StoreTaxInfoRequest } from '../_shared/contracts/index.ts';
import { TaxInfoService } from '../_shared/services/TaxInfoService.ts';
import {
  createMiddlewareStack,
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit,
  withValidation,
  withErrorHandling,
  withSupabaseServiceRole,
  type RequestIdContext,
  type CORSContext,
  type AuthContext,
  type ValidationContext,
  type SupabaseServiceRoleContext,
} from '../_shared/middleware/index.ts';

// Context type includes all middleware contexts
type Context = RequestIdContext &
  CORSContext &
  AuthContext &
  ValidationContext<StoreTaxInfoRequest> &
  SupabaseServiceRoleContext;

// Main handler with middleware-injected context
const handler = async (req: Request, ctx: Context): Promise<Response> => {
  const { requestId, corsHeaders, user, supabase, input, config } = ctx;

  console.log(`[${requestId}] Storing tax info for user ${user.id}`);

  // BUSINESS LOGIC
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
    JSON.stringify({ success: true, message: 'Tax information stored successfully' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
};

// Compose middleware stack
const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withSupabaseServiceRole,
  withAuth,
  withRateLimit(RATE_LIMITS.TAX_INFO),
  withValidation(StoreTaxInfoRequestSchema),
  withErrorHandling
]);

// Serve with composed middleware
serve((req) => middlewareStack(handler)(req, {} as Context));
