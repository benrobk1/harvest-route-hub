import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * BATCH OPTIMIZATION CONTRACTS
 * Schemas for AI-powered batch optimization
 */

export const OptimizeBatchesRequestSchema = z.object({
  delivery_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(date => !isNaN(Date.parse(date)), 'Invalid date value'),
});

export type OptimizeBatchesRequest = z.infer<typeof OptimizeBatchesRequestSchema>;

export const OptimizeBatchesResponseSchema = z.object({
  success: z.boolean(),
  delivery_date: z.string(),
  batches_created: z.number().int(),
  total_orders: z.number().int(),
  optimization_method: z.enum(['ai_powered', 'geographic_fallback']),
  batches: z.array(z.object({
    batch_id: z.string().uuid(),
    batch_number: z.number().int(),
    order_count: z.number().int(),
  })).optional(),
});

export type OptimizeBatchesResponse = z.infer<typeof OptimizeBatchesResponseSchema>;

export const OptimizeBatchesErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'VALIDATION_ERROR', 'OPTIMIZATION_FAILED']),
});

export type OptimizeBatchesError = z.infer<typeof OptimizeBatchesErrorSchema>;
