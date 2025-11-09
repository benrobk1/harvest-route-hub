/**
 * Test data factory for users with different roles
 */
export const createMockUser = (overrides = {}) => ({
  id: 'user-' + Math.random().toString(36).substr(2, 9),
  email: `test${Math.random().toString(36).substr(2, 5)}@example.com`,
  full_name: 'Test User',
  street_address: '123 Main St',
  city: 'New York',
  state: 'NY',
  zip_code: '10001',
  phone: '555-0100',
  approval_status: 'approved',
  applied_role: 'consumer',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockConsumer = (overrides = {}) => 
  createMockUser({ applied_role: 'consumer', ...overrides });

export const createMockFarmer = (overrides = {}) =>
  createMockUser({ 
    applied_role: 'farmer',
    farm_name: 'Test Farm',
    farm_description: 'A test farm',
    ...overrides 
  });

export const createMockDriver = (overrides = {}) =>
  createMockUser({ applied_role: 'driver', ...overrides });

export const createMockAdmin = (overrides = {}) =>
  createMockUser({ applied_role: 'admin', ...overrides });
