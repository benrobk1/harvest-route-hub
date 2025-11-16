import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * ORDER MANAGEMENT CONTRACTS
 * Schemas for order operations
 */

export const CancelOrderRequestSchema = z.object({
  orderId: z.string().uuid('Invalid order ID format'),
});

export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;

export const CancelOrderResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type CancelOrderResponse = z.infer<typeof CancelOrderResponseSchema>;

export const CancelOrderErrorSchema = z.object({
  error: z.string(),
  code: z.enum([
    'ORDER_NOT_FOUND',
    'INVALID_STATUS',
    'TOO_LATE_TO_CANCEL',
    'INVENTORY_RESTORE_FAILED',
    'DELETION_FAILED',
  ]),
});

export type CancelOrderError = z.infer<typeof CancelOrderErrorSchema>;
