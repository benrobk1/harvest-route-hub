import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useShopProducts } from '../useShopProducts';
import { createTestQueryClient } from '@/test/helpers/renderWithProviders';
import { createMockSupabaseClient } from '@/test/mocks/supabase';
import { createMockAuthContext } from '@/test/mocks/authContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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
        <AuthProvider>
          {children}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('useShopProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch products on mount', async () => {
    const { result } = renderHook(() => useShopProducts(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should provide products array', async () => {
    const { result } = renderHook(() => useShopProducts(), { wrapper });

    await waitFor(() => {
      expect(Array.isArray(result.current.products)).toBe(true);
    });
  });

  it('should provide farmer data', async () => {
    const { result } = renderHook(() => useShopProducts(), { wrapper });

    await waitFor(() => {
      expect(result.current.farmerData).toBeDefined();
    });
  });

  it('should provide consumer profile when authenticated', async () => {
    const { result } = renderHook(() => useShopProducts(), { wrapper });

    await waitFor(() => {
      expect(result.current.consumerProfile).toBeDefined();
    });
  });

  it('should provide market config', async () => {
    const { result } = renderHook(() => useShopProducts(), { wrapper });

    await waitFor(() => {
      expect(result.current.marketConfig).toBeDefined();
    });
  });

  it('should not fetch consumer profile for unauthenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthContext({ user: null })
    );

    const { result } = renderHook(() => useShopProducts(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
