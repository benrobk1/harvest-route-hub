/**
 * CHECKOUT CONTRACTS (DENO-COMPATIBLE)
 * 
 * Re-exports shared validation schemas from src/contracts for edge functions.
 * Uses Deno-compatible Zod import path.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Request schema
export const CheckoutRequestSchema = z.object({
  cart_id: z.string().uuid({ message: "Invalid cart ID" }),
  delivery_date: z.string().datetime({ message: "Invalid delivery date format" }),
  use_credits: z.boolean().default(false),
  payment_method_id: z.string().optional(),
  tip_amount: z.number().min(0, { message: "Tip amount must be positive" }).default(0),
  is_demo_mode: z.boolean().optional().default(false),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

// Response schema
export const CheckoutResponseSchema = z.object({
  success: z.boolean(),
  order_id: z.string().uuid(),
  client_secret: z.string().optional(),
  amount_charged: z.number(),
  credits_redeemed: z.number(),
  payment_status: z.enum(['paid', 'pending', 'requires_action']),
});

export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

// Error codes
export const CheckoutErrorCodeSchema = z.enum([
  'UNAUTHORIZED',
  'TOO_MANY_REQUESTS',
  'MISSING_ADDRESS',
  'INVALID_ADDRESS',
  'INVALID_CART',
  'EMPTY_CART',
  'MISSING_PROFILE_INFO',
  'NO_MARKET_CONFIG',
  'INVALID_DELIVERY_DATE',
  'CUTOFF_PASSED',
  'INSUFFICIENT_INVENTORY',
  'BELOW_MINIMUM_ORDER',
  'PAYMENT_FAILED',
  'CHECKOUT_ERROR',
]);

export type CheckoutErrorCode = z.infer<typeof CheckoutErrorCodeSchema>;
