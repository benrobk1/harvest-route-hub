/**
 * Test data factory for orders
 */
export const createMockOrder = (overrides = {}) => ({
  id: 'order-' + Math.random().toString(36).substr(2, 9),
  consumer_id: 'consumer-123',
  delivery_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  status: 'pending',
  subtotal: 50.00,
  delivery_fee: 7.50,
  tip_amount: 0,
  total_amount: 57.50,
  payment_status: 'paid',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockOrderItem = (overrides = {}) => ({
  id: 'item-' + Math.random().toString(36).substr(2, 9),
  order_id: 'order-123',
  product_id: 'product-123',
  quantity: 2,
  unit_price: 9.99,
  subtotal: 19.98,
  farmer_payout: 17.58,
  lead_farmer_payout: 0.40,
  platform_fee: 1.00,
  ...overrides,
});
