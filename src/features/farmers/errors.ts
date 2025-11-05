/**
 * FARMER FEATURE ERROR TYPES
 * Feature-specific error creators for farmer operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createProductError = (message = 'Failed to save product'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Product operation failed');

export const createInventoryError = (message = 'Failed to update inventory'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Inventory update failed');

export const createCSVImportError = (message = 'Failed to import CSV file', context?: Record<string, unknown>): BaseAppError =>
  new BaseAppError(ErrorCode.VALIDATION_ERROR, message, 'CSV import validation failed', context);

export const createInvalidFileError = (message = 'Invalid file type'): BaseAppError =>
  new BaseAppError(ErrorCode.VALIDATION_ERROR, message, 'File validation failed');

export const createBatchError = (message = 'Failed to process batch'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Batch operation failed');

export const createFarmerPayoutError = (message = 'Failed to load payout information'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Farmer payout data fetch failed');

export const createStripeConnectError = (message = 'Failed to connect Stripe account'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Stripe Connect operation failed');
