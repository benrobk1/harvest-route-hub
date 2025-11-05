/**
 * CONSUMER FEATURE ERROR TYPES
 * Feature-specific error creators for consumer operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createReferralError = (message = 'Failed to process referral'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Referral operation failed');

export const createSubscriptionError = (message = 'Failed to manage subscription'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Subscription operation failed');

export const createCreditsError = (message = 'Failed to load credits information'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Credits data fetch failed');

export const createRatingError = (message = 'Failed to submit rating'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Rating submission failed');
