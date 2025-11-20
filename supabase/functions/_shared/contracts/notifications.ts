import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * NOTIFICATION CONTRACTS
 * Schemas for email and push notification operations
 */

export const NotificationEventTypeSchema = z.enum([
  'order_confirmation',
  'order_locked',
  'batch_assigned_driver',
  'batch_assigned_farmer',
  'cutoff_reminder',
  'admin_alert',
  'customer_delivery_update',
]);

export type NotificationEventType = z.infer<typeof NotificationEventTypeSchema>;

export const SendNotificationRequestSchema = z.object({
  event_type: NotificationEventTypeSchema,
  recipient_id: z.string().uuid('Invalid recipient ID format'),
  recipient_email: z.string().email('Invalid email format').optional(),
  data: z.object({
    order_id: z.string().uuid('Invalid order ID format').optional(),
    batch_id: z.string().uuid('Invalid batch ID format').optional(),
    delivery_date: z.string().optional(),
    total_amount: z.number().nonnegative('Total amount must be non-negative').optional(),
    credits_used: z.number().nonnegative('Credits used must be non-negative').optional(),
    batch_number: z.number().int().positive('Batch number must be positive').optional(),
    order_count: z.number().int().nonnegative('Order count must be non-negative').optional(),
    stop_count: z.number().int().nonnegative('Stop count must be non-negative').optional(),
    // Admin alert specific fields
    title: z.string().optional(),
    category: z.string().optional(),
    severity: z.string().optional(),
    description: z.string().optional(),
    reporter_type: z.string().optional(),
    issue_id: z.string().uuid().optional(),
  }),
});

export type SendNotificationRequest = z.infer<typeof SendNotificationRequestSchema>;

export const SendNotificationResponseSchema = z.object({
  success: z.boolean(),
  response: z.unknown().optional(),
});

export type SendNotificationResponse = z.infer<typeof SendNotificationResponseSchema>;

export const SendNotificationErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'NO_EMAIL_FOUND', 'VALIDATION_ERROR', 'NOTIFICATION_ERROR']),
});

export type SendNotificationError = z.infer<typeof SendNotificationErrorSchema>;

// Push Notification Schemas
export const SendPushNotificationRequestSchema = z.object({
  user_id: z.string().uuid('Invalid user ID format'),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  body: z.string().min(1, 'Body is required').max(500, 'Body must be less than 500 characters'),
  data: z.object({
    eta: z.string().optional(),
    stopsRemaining: z.number().int().nonnegative().optional(),
  }).optional(),
});

export type SendPushNotificationRequest = z.infer<typeof SendPushNotificationRequestSchema>;

export const SendPushNotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type SendPushNotificationResponse = z.infer<typeof SendPushNotificationResponseSchema>;

export const SendPushNotificationErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['UNAUTHORIZED', 'USER_NOT_FOUND', 'NOTIFICATIONS_DISABLED', 'SERVER_ERROR']),
});

export type SendPushNotificationError = z.infer<typeof SendPushNotificationErrorSchema>;
