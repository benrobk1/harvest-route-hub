/**
 * Test data factory for delivery batches
 */
export const createMockBatch = (overrides = {}) => ({
  id: 'batch-' + Math.random().toString(36).substr(2, 9),
  batch_number: Math.floor(Math.random() * 1000) + 1,
  delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  driver_id: null,
  status: 'pending',
  total_stops: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockBatchStop = (overrides = {}) => ({
  id: 'stop-' + Math.random().toString(36).substr(2, 9),
  delivery_batch_id: 'batch-123',
  order_id: 'order-123',
  sequence_number: 1,
  status: 'pending',
  address_visible_at: null,
  delivered_at: null,
  box_code: null,
  ...overrides,
});

export const createMockRoute = (overrides = {}) => ({
  id: 'route-' + Math.random().toString(36).substr(2, 9),
  batch_number: Math.floor(Math.random() * 1000) + 1,
  delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  total_stops: 5,
  estimated_earnings: 75.00,
  status: 'available',
  ...overrides,
});
