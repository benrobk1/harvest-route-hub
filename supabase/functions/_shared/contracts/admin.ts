import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * ADMIN CONTRACTS
 * Schemas for admin-only operations
 */

export const Generate1099RequestSchema = z.object({
  year: z.number().int().min(2020, 'Year must be 2020 or later').max(2030, 'Year must be 2030 or earlier'),
  recipient_id: z.string().uuid('Invalid recipient ID format'),
});

export type Generate1099Request = z.infer<typeof Generate1099RequestSchema>;

export const Generate1099ResponseSchema = z.object({
  below_threshold: z.boolean().optional(),
  message: z.string().optional(),
  total: z.number().optional(),
});

export type Generate1099Response = z.infer<typeof Generate1099ResponseSchema>;

export const Generate1099ErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'RECIPIENT_NOT_FOUND', 'NO_TAX_INFO', 'GENERATION_FAILED']),
});

export type Generate1099Error = z.infer<typeof Generate1099ErrorSchema>;
