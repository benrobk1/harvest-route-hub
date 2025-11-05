/**
 * PRODUCT FEATURE ERROR TYPES
 * Feature-specific error creators for product operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createProductLoadError = (message = 'Failed to load products'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Product data fetch failed');

export const createProductSearchError = (message = 'Failed to search products'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Product search operation failed');

export const createProductApprovalError = (message = 'Failed to approve product'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Product approval operation failed');
