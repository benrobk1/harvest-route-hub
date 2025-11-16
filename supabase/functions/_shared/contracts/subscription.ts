import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * SUBSCRIPTION CONTRACTS
 * Schemas for subscription checking and management
 */

export const CheckSubscriptionResponseSchema = z.object({
  subscribed: z.boolean(),
  subscription_end: z.string().nullable(),
  is_trialing: z.boolean(),
  trial_end: z.string().nullable(),
  monthly_spend: z.number(),
  credits_available: z.number(),
  progress_to_credit: z.number(),
});

export type CheckSubscriptionResponse = z.infer<typeof CheckSubscriptionResponseSchema>;

export const CheckSubscriptionErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'STRIPE_ERROR', 'SERVER_ERROR']),
});

export type CheckSubscriptionError = z.infer<typeof CheckSubscriptionErrorSchema>;
