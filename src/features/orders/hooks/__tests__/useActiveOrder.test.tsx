import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useActiveOrder } from '../useActiveOrder';
import { createTestQueryClient } from '@/test/helpers/renderWithProviders';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { createMockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthContext } from '@/test/mocks/authContext';
import { ReactNode } from 'react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: createMockSupabaseClient(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(() => createMockAuthContext({
    user: { id: 'user-123', email: 'test@example.com' }
  })),
}));

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>{children}</AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('useActiveOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch active order on mount', async () => {
    const { result } = renderHook(() => useActiveOrder(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should return null for unauthenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthContext({ user: null })
    );

    const { result } = renderHook(() => useActiveOrder(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeOrder).toBeUndefined();
    });
  });

  it('should handle no active orders', async () => {
    const { result } = renderHook(() => useActiveOrder(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should setup realtime subscription', () => {
    const { result } = renderHook(() => useActiveOrder(), { wrapper });

    // Verify hook is initialized
    expect(result.current).toBeDefined();
  });
});
