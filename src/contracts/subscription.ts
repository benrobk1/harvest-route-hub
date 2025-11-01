import { z } from 'zod';

/**
 * SUBSCRIPTION CONTRACTS
 * Schemas for subscription management
 */

// Subscription status enum
export const SubscriptionStatusSchema = z.enum([
  'active',
  'trialing',
  'canceled',
  'past_due',
  'unpaid',
  'incomplete',
]);

export type SubscriptionStatusType = z.infer<typeof SubscriptionStatusSchema>;

// Subscription check response
export const SubscriptionStatusResponseSchema = z.object({
  subscribed: z.boolean(),
  status: SubscriptionStatusSchema.nullable(),
  trial_end: z.string().datetime().nullable(),
  current_period_end: z.string().datetime().nullable(),
});

export type SubscriptionStatusResponse = z.infer<typeof SubscriptionStatusResponseSchema>;

// Create subscription checkout request
export const CreateSubscriptionCheckoutRequestSchema = z.object({
  price_id: z.string(), // Stripe price ID
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});

export type CreateSubscriptionCheckoutRequest = z.infer<typeof CreateSubscriptionCheckoutRequestSchema>;

// Create subscription checkout response
export const CreateSubscriptionCheckoutResponseSchema = z.object({
  url: z.string().url(), // Stripe checkout URL
});

export type CreateSubscriptionCheckoutResponse = z.infer<typeof CreateSubscriptionCheckoutResponseSchema>;
