import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductSearch } from '../useProductSearch';
import { createMockProducts } from '@/test/factories/productFactory';

describe('useProductSearch', () => {
  const mockProducts = createMockProducts(5, {
    farm_profiles: { id: 'farm-1', farm_name: 'Test Farm', location: null },
    harvest_date: null,
  }) as any;

  it('should initialize with empty search query', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    expect(result.current.searchQuery).toBe('');
    expect(result.current.filteredProducts).toHaveLength(5);
  });

  it('should filter products by name', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    act(() => {
      result.current.setSearchQuery('Product 1');
    });

    expect(result.current.searchQuery).toBe('Product 1');
    expect(result.current.filteredProducts).toHaveLength(1);
    expect(result.current.filteredProducts[0].name).toBe('Product 1');
  });

  it('should filter products case-insensitively', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    act(() => {
      result.current.setSearchQuery('product 1');
    });

    expect(result.current.filteredProducts).toHaveLength(1);
    expect(result.current.filteredProducts[0].name).toBe('Product 1');
  });

  it('should filter products by farm name', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    act(() => {
      result.current.setSearchQuery('Test Farm');
    });

    expect(result.current.filteredProducts).toHaveLength(5);
  });

  it('should return all products when search is empty', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    act(() => {
      result.current.setSearchQuery('');
    });

    expect(result.current.filteredProducts).toHaveLength(5);
  });

  it('should return empty array for no matches', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    act(() => {
      result.current.setSearchQuery('NonexistentProduct');
    });

    expect(result.current.filteredProducts).toHaveLength(0);
  });

  it('should update filtered products when search changes', () => {
    const { result } = renderHook(() => useProductSearch(mockProducts));

    act(() => {
      result.current.setSearchQuery('Product 1');
    });
    expect(result.current.filteredProducts).toHaveLength(1);

    act(() => {
      result.current.setSearchQuery('Product 2');
    });
    expect(result.current.filteredProducts).toHaveLength(1);
    expect(result.current.filteredProducts[0].name).toBe('Product 2');
  });
});
