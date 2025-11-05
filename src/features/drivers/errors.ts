/**
 * DRIVER FEATURE ERROR TYPES
 * Feature-specific error creators for driver operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createRouteClaimError = (message = 'Failed to claim route'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Route claim operation failed');

export const createDeliveryError = (message = 'Failed to update delivery status'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Delivery update failed');

export const createBoxScanError = (message = 'Invalid box code'): BaseAppError =>
  new BaseAppError(ErrorCode.VALIDATION_ERROR, message, 'Box code scan validation failed');

export const createDriverPayoutError = (message = 'Failed to load payout information'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Driver payout data fetch failed');
