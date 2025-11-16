/**
 * Test data factory for ratings
 */
export const createMockFarmRating = (overrides = {}) => ({
  id: 'rating-' + Math.random().toString(36).substr(2, 9),
  farm_profile_id: 'farm-123',
  consumer_id: 'consumer-123',
  rating: 5,
  feedback: 'Great farm!',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProductRating = (overrides = {}) => ({
  id: 'rating-' + Math.random().toString(36).substr(2, 9),
  product_id: 'product-123',
  consumer_id: 'consumer-123',
  order_id: 'order-123',
  rating: 5,
  feedback: 'Delicious product!',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockDriverRating = (overrides = {}) => ({
  id: 'rating-' + Math.random().toString(36).substr(2, 9),
  driver_id: 'driver-123',
  consumer_id: 'consumer-123',
  order_id: 'order-123',
  rating: 5,
  feedback: 'Great delivery!',
  created_at: new Date().toISOString(),
  ...overrides,
});
