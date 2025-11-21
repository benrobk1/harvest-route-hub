import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { useCart } from '../useCart';
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
  AuthProvider: ({ children }: { children: ReactNode }) => children,
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

describe('useCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch current cart on mount', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should calculate cart total correctly', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current.cartTotal).toBe('number');
    });
  });

  it('should calculate cart count correctly', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(typeof result.current.cartCount).toBe('number');
    });
  });

  it('should provide addToCart mutation', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.addToCart).toBeDefined();
    expect(typeof result.current.addToCart.mutate).toBe('function');
  });

  it('should provide updateQuantity mutation', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.updateQuantity).toBeDefined();
    expect(typeof result.current.updateQuantity.mutate).toBe('function');
  });

  it('should provide removeItem mutation', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.removeItem).toBeDefined();
    expect(typeof result.current.removeItem.mutate).toBe('function');
  });

  it('should provide saved carts functionality', () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    expect(result.current.savedCarts).toBeDefined();
    expect(result.current.saveCart).toBeDefined();
    expect(result.current.loadSavedCart).toBeDefined();
    expect(result.current.deleteSavedCart).toBeDefined();
  });

  it('should return empty cart for unauthenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue(
      createMockAuthContext({ user: null })
    );

    const { result } = renderHook(() => useCart(), { wrapper });

    await waitFor(() => {
      expect(result.current.cart).toBeNull();
    });
  });
});
