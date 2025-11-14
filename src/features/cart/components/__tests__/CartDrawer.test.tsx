import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { CartDrawer } from '../CartDrawer';
import { renderWithProviders } from '@/test/helpers/renderWithProviders';
import { useCart } from '../hooks/useCart';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, onClick }: any) => (
      <a href={to} onClick={onClick}>{children}</a>
    ),
  };
});

vi.mock('../hooks/useCart', () => ({
  useCart: vi.fn(() => ({
    cart: null,
    cartCount: 0,
    cartTotal: 0,
    isLoading: false,
    updateQuantity: { mutate: vi.fn() },
    removeItem: { mutate: vi.fn() },
    savedCarts: [],
    saveCart: { mutate: vi.fn(), isPending: false },
    loadSavedCart: { mutate: vi.fn(), isPending: false },
    deleteSavedCart: { mutate: vi.fn(), isPending: false },
  })),
}));

describe('CartDrawer', () => {
  it('should render Cart button', () => {
    renderWithProviders(<CartDrawer />);

    expect(screen.getByText('Cart')).toBeDefined();
  });

  it('should show cart count badge when items exist', () => {
    vi.mocked(useCart).mockReturnValue({
      cart: { items: [{ id: '1', quantity: 2 }] },
      cartCount: 2,
      cartTotal: 25,
      isLoading: false,
      updateQuantity: { mutate: vi.fn() },
      removeItem: { mutate: vi.fn() },
      savedCarts: [],
      saveCart: { mutate: vi.fn(), isPending: false },
      loadSavedCart: { mutate: vi.fn(), isPending: false },
      deleteSavedCart: { mutate: vi.fn(), isPending: false },
    });

    renderWithProviders(<CartDrawer />);

    expect(screen.getByText('2')).toBeDefined();
  });

  it('should open drawer when Cart button clicked', () => {
    renderWithProviders(<CartDrawer />);

    const cartButton = screen.getByText('Cart');
    fireEvent.click(cartButton);

    expect(screen.getByText('Shopping Cart')).toBeDefined();
  });

  it('should show empty cart message when no items', () => {
    renderWithProviders(<CartDrawer />);

    fireEvent.click(screen.getByText('Cart'));

    expect(screen.getByText('Your cart is empty')).toBeDefined();
  });

  it('should render cart tabs', () => {
    renderWithProviders(<CartDrawer />);

    fireEvent.click(screen.getByText('Cart'));

    expect(screen.getByRole('tab', { name: /Cart/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Saved/ })).toBeDefined();
  });

  it('should show minimum order message when below threshold', () => {
    vi.mocked(useCart).mockReturnValue({
      cart: { 
        items: [{ 
          id: '1', 
          quantity: 1, 
          unit_price: 10,
          products: { name: 'Test', unit: 'lb', farm_profiles: { farm_name: 'Farm' } }
        }] 
      },
      cartCount: 1,
      cartTotal: 10,
      isLoading: false,
      updateQuantity: { mutate: vi.fn() },
      removeItem: { mutate: vi.fn() },
      savedCarts: [],
      saveCart: { mutate: vi.fn(), isPending: false },
      loadSavedCart: { mutate: vi.fn(), isPending: false },
      deleteSavedCart: { mutate: vi.fn(), isPending: false },
    });

    renderWithProviders(<CartDrawer />);

    fireEvent.click(screen.getByText('Cart'));

    expect(screen.getByText(/Minimum order: \$25.00/)).toBeDefined();
  });

  it('should show Save Cart button when items exist', () => {
    vi.mocked(useCart).mockReturnValue({
      cart: { 
        items: [{ 
          id: '1', 
          quantity: 1,
          unit_price: 10,
          products: { name: 'Test', unit: 'lb', farm_profiles: { farm_name: 'Farm' } }
        }] 
      },
      cartCount: 1,
      cartTotal: 10,
      isLoading: false,
      updateQuantity: { mutate: vi.fn() },
      removeItem: { mutate: vi.fn() },
      savedCarts: [],
      saveCart: { mutate: vi.fn(), isPending: false },
      loadSavedCart: { mutate: vi.fn(), isPending: false },
      deleteSavedCart: { mutate: vi.fn(), isPending: false },
    });

    renderWithProviders(<CartDrawer />);

    fireEvent.click(screen.getByText('Cart'));

    expect(screen.getByText('Save Cart')).toBeDefined();
  });
});
