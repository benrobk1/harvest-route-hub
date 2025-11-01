import { z } from 'zod';

/**
 * PAYOUT CONTRACTS
 * Schemas for payout processing and tracking
 */

// Payout type enum
export const PayoutTypeSchema = z.enum([
  'farmer',
  'lead_farmer',
  'driver',
  'platform_fee',
]);

export type PayoutType = z.infer<typeof PayoutTypeSchema>;

// Payout status enum
export const PayoutStatusSchema = z.enum([
  'pending',
  'processing',
  'paid',
  'failed',
]);

export type PayoutStatus = z.infer<typeof PayoutStatusSchema>;

// Request schema for manual payout triggering
export const ProcessPayoutsRequestSchema = z.object({
  order_ids: z.array(z.string().uuid()).optional(), // Process specific orders, or all pending if omitted
  payout_type: PayoutTypeSchema.optional(), // Filter by payout type
});

export type ProcessPayoutsRequest = z.infer<typeof ProcessPayoutsRequestSchema>;

// Response schema
export const ProcessPayoutsResponseSchema = z.object({
  success: z.boolean(),
  payouts_processed: z.number().int(),
  total_amount: z.number(),
  failures: z.array(z.object({
    payout_id: z.string().uuid(),
    error: z.string(),
  })).optional(),
});

export type ProcessPayoutsResponse = z.infer<typeof ProcessPayoutsResponseSchema>;
