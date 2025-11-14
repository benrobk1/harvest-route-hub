/**
 * MIDDLEWARE EXPORTS
 * Centralized export for all middleware utilities.
 *
 * Enterprise documentation: ./README.md
 */

export { withAuth } from './withAuth.ts';
export { withAdminAuth } from './withAdminAuth.ts';
export { withCORS } from './withCORS.ts';
export { withErrorHandling } from './withErrorHandling.ts';
export { withRateLimit } from './withRateLimit.ts';
export { withRequestId } from './withRequestId.ts';
export { withSupabaseServiceRole } from './withSupabaseServiceRole.ts';
export { withValidation } from './withValidation.ts';
export { composeMiddleware, createMiddlewareStack } from './compose.ts';

export type { AuthContext } from './withAuth.ts';
export type { CORSContext } from './withCORS.ts';
export type { SupabaseServiceRoleContext } from './withSupabaseServiceRole.ts';
