/**
 * Test data factory for products
 */
export const createMockProduct = (overrides = {}) => ({
  id: 'product-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Product',
  description: 'A test product description',
  price: 9.99,
  unit: 'lb',
  available_quantity: 50,
  farm_profile_id: 'farmer-123',
  image_url: 'https://example.com/image.jpg',
  is_approved: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProducts = (count: number, overrides = {}) =>
  Array.from({ length: count }, (_, i) =>
    createMockProduct({ name: `Product ${i + 1}`, ...overrides })
  );
