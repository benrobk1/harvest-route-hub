/**
 * CART FEATURE ERROR TYPES
 * Feature-specific error creators for cart operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createAddToCartError = (message = 'Failed to add item to cart'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Add to cart operation failed');

export const createRemoveFromCartError = (message = 'Failed to remove item from cart'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Remove from cart operation failed');

export const createUpdateCartError = (message = 'Failed to update cart'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Cart update operation failed');

export const createSaveCartError = (message = 'Failed to save cart'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Cart save operation failed');

export const createLoadCartError = (message = 'Failed to load saved cart'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Saved cart load operation failed');
