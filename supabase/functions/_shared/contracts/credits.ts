import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * CREDITS CONTRACTS
 * Schemas for credit management and awarding
 */

export const TransactionTypeSchema = z.enum(['earned', 'bonus', 'refund']);

export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const AwardCreditsRequestSchema = z.object({
  consumer_id: z.string().uuid('Invalid consumer ID format'),
  amount: z.number().positive('Amount must be positive').max(1000, 'Amount cannot exceed $1000'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  transaction_type: TransactionTypeSchema.optional(),
  expires_in_days: z.number().int().positive().max(365, 'Expiration cannot exceed 365 days').optional(),
});

export type AwardCreditsRequest = z.infer<typeof AwardCreditsRequestSchema>;

export const AwardCreditsResponseSchema = z.object({
  success: z.boolean(),
  credit_id: z.string().uuid(),
  amount_awarded: z.number(),
  new_balance: z.number(),
  expires_at: z.string(),
});

export type AwardCreditsResponse = z.infer<typeof AwardCreditsResponseSchema>;

export const AwardCreditsErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'VALIDATION_ERROR', 'CREDIT_AWARD_FAILED']),
});

export type AwardCreditsError = z.infer<typeof AwardCreditsErrorSchema>;
