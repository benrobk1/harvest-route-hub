/**
 * ADMIN FEATURE ERROR TYPES
 * Feature-specific error creators for admin operations
 */

import { BaseAppError, ErrorCode } from '@/lib/errors/ErrorTypes';

export const createAdminRoleError = (message = 'Failed to update user role'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Admin role operation failed');

export const createCreditsError = (message = 'Failed to manage credits'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Credits management failed');

export const createKPIError = (message = 'Failed to load dashboard metrics'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'KPI data fetch failed');

export const createUserApprovalError = (message = 'Failed to approve user'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'User approval operation failed');

export const createTaxDocumentError = (message = 'Failed to generate tax document'): BaseAppError =>
  new BaseAppError(ErrorCode.SERVER_ERROR, message, 'Tax document generation failed');
