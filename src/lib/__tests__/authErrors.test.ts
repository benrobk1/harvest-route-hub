import { describe, it, expect } from 'vitest';
import { getAuthErrorMessage } from '../authErrors';

describe('authErrors', () => {
  it('should return message for invalid credentials', () => {
    const result = getAuthErrorMessage('Invalid login credentials');
    expect(result.description).toContain('incorrect');
  });

  it('should return message for user not found', () => {
    const result = getAuthErrorMessage('User not found');
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('should return message for email already exists', () => {
    const result = getAuthErrorMessage('User already registered');
    expect(result.description).toContain('already');
  });

  it('should return message for weak password', () => {
    const result = getAuthErrorMessage('Password should be at least 6 characters');
    expect(result.description).toContain('at least 6 characters');
  });

  it('should return generic message for unknown errors', () => {
    const result = getAuthErrorMessage('Some random error');
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('should handle null error message', () => {
    const result = getAuthErrorMessage(null);
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('should handle undefined error message', () => {
    const result = getAuthErrorMessage(undefined);
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });
});
