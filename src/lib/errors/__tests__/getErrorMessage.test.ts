import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '../getErrorMessage';

describe('getErrorMessage', () => {
  describe('Error instances', () => {
    it('returns error message for Error instances', () => {
      const error = new Error('Something went wrong');
      expect(getErrorMessage(error)).toBe('Something went wrong');
    });

    it('handles TypeError', () => {
      const error = new TypeError('Type error occurred');
      expect(getErrorMessage(error)).toBe('Type error occurred');
    });

    it('handles ReferenceError', () => {
      const error = new ReferenceError('Reference error occurred');
      expect(getErrorMessage(error)).toBe('Reference error occurred');
    });

    it('handles custom Error subclasses', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const error = new CustomError('Custom error message');
      expect(getErrorMessage(error)).toBe('Custom error message');
    });
  });

  describe('String errors', () => {
    it('returns the string as-is', () => {
      expect(getErrorMessage('Error string')).toBe('Error string');
    });

    it('handles empty strings', () => {
      expect(getErrorMessage('')).toBe('');
    });

    it('handles multi-line strings', () => {
      const multiLine = 'Line 1\nLine 2\nLine 3';
      expect(getErrorMessage(multiLine)).toBe(multiLine);
    });
  });

  describe('Objects with sensitive data', () => {
    it('redacts "token" field', () => {
      const error = { message: 'Auth failed', token: 'secret-token-123' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('secret-token-123');
      expect(result).toContain('Auth failed');
    });

    it('redacts "password" field', () => {
      const error = { user: 'john', password: 'super-secret' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('super-secret');
      expect(result).toContain('john');
    });

    it('redacts "secret" field', () => {
      const error = { code: 500, secret: 'my-secret-key' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('my-secret-key');
    });

    it('redacts "apiKey" field', () => {
      const error = { service: 'stripe', apiKey: 'sk_live_123456' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('sk_live_123456');
    });

    it('redacts "authorization" field', () => {
      const error = { endpoint: '/api/users', authorization: 'Bearer token123' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('Bearer token123');
    });

    it('redacts "access_token" field', () => {
      const error = { status: 'ok', access_token: 'access-123' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('access-123');
    });

    it('redacts "refresh_token" field', () => {
      const error = { status: 'ok', refresh_token: 'refresh-456' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('refresh-456');
    });

    it('redacts camelCase variants like "accessToken"', () => {
      const error = { status: 'ok', accessToken: 'access-789' };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('access-789');
    });

    it('redacts multiple sensitive fields in the same object', () => {
      const error = {
        user: 'admin',
        password: 'pass123',
        apiKey: 'key456',
        token: 'token789',
        status: 'failed',
      };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('pass123');
      expect(result).not.toContain('key456');
      expect(result).not.toContain('token789');
      expect(result).toContain('admin');
      expect(result).toContain('failed');
    });

    it('redacts sensitive fields in nested objects', () => {
      const error = {
        outer: {
          inner: {
            password: 'nested-secret',
            data: 'safe-data',
          },
          token: 'outer-token',
        },
        safe: 'visible',
      };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('nested-secret');
      expect(result).not.toContain('outer-token');
      expect(result).toContain('safe-data');
      expect(result).toContain('visible');
    });

    it('redacts sensitive fields in arrays', () => {
      const error = {
        users: [
          { name: 'Alice', password: 'alice-pass' },
          { name: 'Bob', password: 'bob-pass' },
        ],
      };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('alice-pass');
      expect(result).not.toContain('bob-pass');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
    });

    it('handles objects without sensitive fields', () => {
      const error = { status: 404, message: 'Not found', path: '/api/users' };
      const result = getErrorMessage(error);
      expect(result).toBe(JSON.stringify(error));
    });
  });

  describe('Null and undefined', () => {
    it('returns "Unknown error" for null', () => {
      expect(getErrorMessage(null)).toBe('Unknown error');
    });

    it('returns "Unknown error" for undefined', () => {
      expect(getErrorMessage(undefined)).toBe('Unknown error');
    });
  });

  describe('Primitive types', () => {
    it('handles numbers', () => {
      expect(getErrorMessage(404)).toBe('404');
    });

    it('handles booleans', () => {
      expect(getErrorMessage(false)).toBe('false');
      expect(getErrorMessage(true)).toBe('true');
    });

    it('handles BigInt', () => {
      expect(getErrorMessage(BigInt(9007199254740991))).toBe('9007199254740991');
    });
  });

  describe('Edge cases', () => {
    it('handles circular references gracefully', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error: any = { message: 'Circular' };
      error.self = error;
      const result = getErrorMessage(error);
      // Should return "Unknown error" due to serialization failure
      expect(result).toBe('Unknown error');
    });

    it('handles objects with toJSON method', () => {
      const error = {
        message: 'Custom',
        password: 'secret',
        toJSON() {
          return { message: this.message, custom: true };
        },
      };
      const result = getErrorMessage(error);
      // toJSON controls serialization, so the password field is not included
      // in the output at all (which is safe)
      expect(result).toContain('Custom');
      expect(result).toContain('custom');
      expect(result).not.toContain('password');
      expect(result).not.toContain('secret');
    });

    it('handles empty objects', () => {
      expect(getErrorMessage({})).toBe('{}');
    });

    it('handles arrays', () => {
      const error = [1, 2, 3];
      expect(getErrorMessage(error)).toBe('[1,2,3]');
    });

    it('handles empty arrays', () => {
      expect(getErrorMessage([])).toBe('[]');
    });

    it('handles Date objects', () => {
      const date = new Date('2024-01-01');
      const result = getErrorMessage(date);
      // Date objects serialize to ISO string
      expect(result).toContain('2024-01-01');
    });

    it('handles RegExp objects', () => {
      const regex = /test/gi;
      const result = getErrorMessage(regex);
      expect(result).toBeTruthy();
    });

    it('handles symbols gracefully', () => {
      const sym = Symbol('test');
      const result = getErrorMessage(sym);
      expect(result).toBe('Symbol(test)');
    });
  });

  describe('Case sensitivity', () => {
    it('redacts fields regardless of case', () => {
      const error = {
        Token: 'should-redact',
        PASSWORD: 'should-redact-too',
        ApiKey: 'also-redact',
      };
      const result = getErrorMessage(error);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('should-redact');
      expect(result).not.toContain('should-redact-too');
      expect(result).not.toContain('also-redact');
    });
  });
});
