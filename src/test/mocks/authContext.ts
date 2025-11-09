import { vi } from 'vitest';

/**
 * Mock Auth Context for testing components that use authentication
 */
export const createMockAuthContext = (overrides = {}) => ({
  user: null,
  session: null,
  loading: false,
  signIn: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

/**
 * Mock authenticated user
 */
export const mockAuthenticatedUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
  },
};

/**
 * Mock session
 */
export const mockSession = {
  access_token: 'mock-token-123',
  refresh_token: 'mock-refresh-123',
  expires_at: Date.now() + 3600000,
  user: mockAuthenticatedUser,
};
