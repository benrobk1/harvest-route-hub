import { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { preloadImage } from '@/lib/imageHelpers';
import type { Product } from '../types';

export const useProductSearch = (products: Product[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);

  const filteredProducts = useMemo(
    () => products.filter((product) =>
      product.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      product.farm_profiles.farm_name.toLowerCase().includes(deferredSearch.toLowerCase())
    ),
    [products, deferredSearch]
  );

  useEffect(() => {
    filteredProducts.slice(0, 3).forEach(p => {
      if (p.image_url) preloadImage(p.image_url).catch(() => {});
    });
  }, [filteredProducts]);

  return {
    searchQuery,
    setSearchQuery,
    filteredProducts,
  };
};
