import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from '../authErrors';

describe('authErrors', () => {
  it('should return message for invalid credentials', () => {
    const message = getAuthErrorMessage('Invalid login credentials');
    expect(message).toContain('credentials');
  });

  it('should return message for user not found', () => {
    const message = getAuthErrorMessage('User not found');
    expect(message).toContain('found');
  });

  it('should return message for email already exists', () => {
    const message = getAuthErrorMessage('User already registered');
    expect(message).toContain('already');
  });

  it('should return message for weak password', () => {
    const message = getAuthErrorMessage('Password should be at least 6 characters');
    expect(message).toContain('Password');
  });

  it('should return generic message for unknown errors', () => {
    const message = getAuthErrorMessage('Some random error');
    expect(message).toBeTruthy();
  });

  it('should handle null error message', () => {
    const message = getAuthErrorMessage(null as any);
    expect(message).toBeTruthy();
  });

  it('should handle undefined error message', () => {
    const message = getAuthErrorMessage(undefined as any);
    expect(message).toBeTruthy();
  });
});
