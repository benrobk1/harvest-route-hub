import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * STRIPE CONNECT CONTRACTS
 * Schemas for Stripe Connect operations
 */

export const StripeConnectOnboardRequestSchema = z.object({
  origin: z.string().url('Invalid origin URL').optional(),
  returnPath: z.string().optional(),
});

export type StripeConnectOnboardRequest = z.infer<typeof StripeConnectOnboardRequestSchema>;

export const StripeConnectOnboardResponseSchema = z.object({
  success: z.boolean(),
  url: z.string().url(),
  account_id: z.string(),
});

export type StripeConnectOnboardResponse = z.infer<typeof StripeConnectOnboardResponseSchema>;

export const StripeConnectStatusResponseSchema = z.object({
  connected: z.boolean(),
  onboarding_complete: z.boolean(),
  charges_enabled: z.boolean(),
  payouts_enabled: z.boolean(),
  account_id: z.string().optional(),
});

export type StripeConnectStatusResponse = z.infer<typeof StripeConnectStatusResponseSchema>;

export const StripeConnectErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'INVALID_ROLE', 'STRIPE_ERROR', 'SERVER_ERROR']),
});

export type StripeConnectError = z.infer<typeof StripeConnectErrorSchema>;
