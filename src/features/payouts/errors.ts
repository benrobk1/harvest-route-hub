/**
 * PAYOUT FEATURE ERROR TYPES
 * Feature-specific error creators for payout operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createPayoutLoadError = (message = 'Failed to load payout information'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Payout data fetch failed');

export const createPayoutProcessError = (message = 'Failed to process payout'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Payout processing failed');

export const createPayoutHistoryError = (message = 'Failed to load payout history'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Payout history data fetch failed');
