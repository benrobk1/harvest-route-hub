/**
 * Test data factory for shopping carts
 */
export const createMockCart = (overrides = {}) => ({
  id: 'cart-' + Math.random().toString(36).substr(2, 9),
  consumer_id: 'consumer-123',
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockCartItem = (overrides = {}) => ({
  id: 'cart-item-' + Math.random().toString(36).substr(2, 9),
  cart_id: 'cart-123',
  product_id: 'product-123',
  quantity: 2,
  added_at: new Date().toISOString(),
  ...overrides,
});
