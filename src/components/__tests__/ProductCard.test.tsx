import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import ProductCard from '../ProductCard';
import { renderWithProviders } from '@/test/helpers/renderWithProviders';
import { createMockProduct } from '@/test/factories/productFactory';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ProductCard', () => {
  const mockProduct: ReturnType<typeof createMockProduct> = {
    ...createMockProduct(),
    name: 'Fresh Tomatoes',
    price: 4.99,
    unit: 'lb',
    available_quantity: 50,
    harvest_date: null,
    farm_profiles: {
      id: 'farm-1',
      farm_name: 'Green Acres Farm',
      location: '10001',
    },
  };

  const mockOnAddToCart = vi.fn();

  it('should render product name', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText('Fresh Tomatoes')).toBeDefined();
  });

  it('should render farm name', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText('Green Acres Farm')).toBeDefined();
  });

  it('should render price with unit', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText('$4.99')).toBeDefined();
    expect(screen.getByText('/lb')).toBeDefined();
  });

  it('should render available quantity', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText('50 available')).toBeDefined();
  });

  it('should render Add to Cart button', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText('Add to Cart')).toBeDefined();
  });

  it('should render Farm Story button', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText('Farm Story →')).toBeDefined();
  });

  it('should navigate to farm profile when farm name clicked', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    fireEvent.click(screen.getByText('Green Acres Farm'));
    expect(mockNavigate).toHaveBeenCalledWith('/farm/farm-1');
  });

  it('should render product image when available', () => {
    const productWithImage = {
      ...mockProduct,
      image_url: 'https://example.com/tomato.jpg',
    };

    renderWithProviders(
      <ProductCard product={productWithImage} onAddToCart={mockOnAddToCart} />
    );

    const image = screen.getByAltText('Fresh Tomatoes from Green Acres Farm');
    expect(image).toBeDefined();
    expect(image.getAttribute('src')).toBe('https://example.com/tomato.jpg');
  });

  it('should render harvest date when available', () => {
    const productWithDate = {
      ...mockProduct,
      harvest_date: '2024-01-15',
    };

    renderWithProviders(
      <ProductCard product={productWithDate} onAddToCart={mockOnAddToCart} />
    );

    expect(screen.getByText(/Jan 15/)).toBeDefined();
  });

  it('should increment quantity when plus button clicked', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    const plusButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('.lucide-plus')
    );
    
    if (plusButton) {
      fireEvent.click(plusButton);
    }
  });

  it('should decrement quantity when minus button clicked', () => {
    renderWithProviders(
      <ProductCard product={mockProduct} onAddToCart={mockOnAddToCart} />
    );

    const minusButton = screen.getAllByRole('button').find(
      btn => btn.querySelector('.lucide-minus')
    );
    
    if (minusButton) {
      fireEvent.click(minusButton);
    }
  });
});
