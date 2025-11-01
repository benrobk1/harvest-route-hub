import { z } from 'zod';

/**
 * BATCH OPTIMIZATION CONTRACTS
 * Schemas for delivery batch generation and optimization
 */

// Request schema
export const BatchOptimizationRequestSchema = z.object({
  delivery_date: z.string().optional(), // ISO date string, defaults to tomorrow if not provided
  force_ai: z.boolean().default(false), // Force AI path even if fallback would be used (for testing)
});

export type BatchOptimizationRequest = z.infer<typeof BatchOptimizationRequestSchema>;

// Batch metadata schema
export const BatchMetadataSchema = z.object({
  batch_id: z.number().int().positive(),
  order_count: z.number().int().positive(),
  collection_point_id: z.string(),
  collection_point_address: z.string(),
  zip_codes: z.array(z.string()),
  is_subsidized: z.boolean(),
  rationale: z.string().optional(),
});

export type BatchMetadata = z.infer<typeof BatchMetadataSchema>;

// Response schema
export const BatchOptimizationResponseSchema = z.object({
  success: z.boolean(),
  delivery_date: z.string(),
  batches_created: z.number().int(),
  total_orders: z.number().int(),
  optimization_method: z.enum(['ai', 'geographic_fallback']),
  optimization_confidence: z.number().min(0).max(1).optional(), // 0-1 score from AI
  fallback_reason: z.string().optional(), // Why fallback was used
  batches: z.array(BatchMetadataSchema),
});

export type BatchOptimizationResponse = z.infer<typeof BatchOptimizationResponseSchema>;

// Error schema
export const BatchErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['NO_ORDERS', 'OPTIMIZATION_FAILED', 'DATABASE_ERROR']),
  details: z.record(z.unknown()).optional(),
});

export type BatchError = z.infer<typeof BatchErrorSchema>;
