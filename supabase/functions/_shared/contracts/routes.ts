import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * ROUTE/BATCH CONTRACTS
 * Schemas for driver route claiming
 */

export const ClaimRouteRequestSchema = z.object({
  batch_id: z.string().uuid('Invalid batch ID format'),
});

export type ClaimRouteRequest = z.infer<typeof ClaimRouteRequestSchema>;

export const ClaimRouteResponseSchema = z.object({
  success: z.boolean(),
});

export type ClaimRouteResponse = z.infer<typeof ClaimRouteResponseSchema>;

export const ClaimRouteErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['BATCH_NOT_FOUND', 'BATCH_UNAVAILABLE', 'DRIVER_ROLE_REQUIRED', 'UNAUTHORIZED']),
});

export type ClaimRouteError = z.infer<typeof ClaimRouteErrorSchema>;
