/**
 * ORDER FEATURE ERROR TYPES
 * Feature-specific error creators for order operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createCheckoutError = (message = 'Failed to process checkout'): BaseAppError =>
  new BaseAppError(ErrorCode.PAYMENT_FAILED, message, 'Checkout operation failed');

export const createPaymentError = (message = 'Payment failed'): BaseAppError =>
  new BaseAppError(ErrorCode.PAYMENT_FAILED, message, 'Payment processing failed');

export const createOrderNotFoundError = (message = 'Order not found'): BaseAppError =>
  new BaseAppError(ErrorCode.ORDER_NOT_FOUND, message, 'Order lookup failed');

export const createOrderCancelError = (message = 'Failed to cancel order'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Order cancellation failed');

export const createOrderTrackingError = (message = 'Failed to load order tracking'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Order tracking data fetch failed');
