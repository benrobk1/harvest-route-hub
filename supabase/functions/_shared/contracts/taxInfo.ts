import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * TAX INFORMATION CONTRACTS
 * Schemas for secure tax data storage
 */

export const TaxIdTypeSchema = z.enum(['EIN', 'SSN']);

export type TaxIdType = z.infer<typeof TaxIdTypeSchema>;

export const StoreTaxInfoRequestSchema = z.object({
  tax_id: z.string().min(9, 'Tax ID must be at least 9 characters').max(11, 'Tax ID must be at most 11 characters'),
  tax_id_type: TaxIdTypeSchema,
  tax_name: z.string().min(1, 'Tax name is required').max(200, 'Tax name must be less than 200 characters'),
  tax_address: z.string().min(1, 'Tax address is required').max(500, 'Tax address must be less than 500 characters'),
});

export type StoreTaxInfoRequest = z.infer<typeof StoreTaxInfoRequestSchema>;

export const StoreTaxInfoResponseSchema = z.object({
  success: z.boolean(),
});

export type StoreTaxInfoResponse = z.infer<typeof StoreTaxInfoResponseSchema>;
