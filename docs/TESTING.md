# Comprehensive Testing Guide

**Last Updated**: November 2025  
**Status**: Production Ready

## Overview

This project follows a comprehensive testing strategy covering unit tests, integration tests, E2E tests, and performance tests.

### Testing Tools
- **Vitest**: Unit and integration testing
- **Playwright**: E2E browser automation  
- **Deno**: Edge function testing
- **Custom Scripts**: Performance and load testing

## Test Structure

```
project/
├── src/
│   ├── lib/__tests__/          # Utility function tests
│   ├── features/
│   │   └── [feature]/__tests__/ # Feature-specific tests
│   ├── components/__tests__/    # Component tests
│   └── test/
│       ├── setup.ts             # Test configuration
│       ├── factories/           # Test data factories
│       ├── mocks/               # Mock implementations
│       └── helpers/             # Test utilities
├── e2e/                         # E2E test specs
├── supabase/functions/__tests__/ # Edge function tests
└── scripts/                     # Performance tests
```

## Running Tests

### All Tests
```bash
npm test                    # Run all tests once
npm run test:unit          # Run tests in watch mode
npm run test:coverage      # Run with coverage report
npm run test:coverage:ui   # Interactive coverage report
```

### Edge Function Tests
```bash
cd supabase/functions
deno test --allow-all __tests__/
deno test --allow-all --coverage=coverage __tests__/
deno coverage coverage
```

### E2E Tests
```bash
npm run test:e2e          # Run all E2E tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:e2e:headed   # Run in headed mode
```

### Performance Tests
```bash
npm run test:performance  # Benchmark critical paths
npm run loadtest         # Comprehensive load test
```

## Code Coverage

### Coverage Thresholds

The project enforces minimum coverage thresholds:
- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html

# Interactive UI
npm run test:coverage:ui
```

### Coverage Configuration

**Excluded from coverage:**
- Auto-generated files (`src/integrations/supabase/types.ts`)
- Test files and configuration
- UI component library (tested via integration tests)
- Type definitions
- Build artifacts

**Included in coverage:**
- All source files in `src/**/*.{ts,tsx}`
- Feature modules
- Business logic utilities
- Custom hooks
- Services and helpers

## Unit Testing

### Writing Unit Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCart } from '../useCart';
import { renderWithProviders } from '@/test/helpers/renderWithProviders';

describe('useCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add item to cart', async () => {
    const { result } = renderHook(() => useCart(), {
      wrapper: renderWithProviders
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.addToCart({
      productId: '123',
      quantity: 2
    });

    expect(result.current.items).toHaveLength(1);
  });
});
```

### Test Factories

Use factories for consistent test data:

```typescript
import { createTestProduct } from '@/test/factories/productFactory';

const product = createTestProduct({
  price: 10.99,
  available_quantity: 50
});
```

### Mocking Supabase

```typescript
import { mockSupabase } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));
```

## Integration Testing

Integration tests verify feature workflows:

```typescript
import { describe, it, expect } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers/renderWithProviders';
import CartDrawer from '../CartDrawer';

describe('Cart Integration', () => {
  it('should complete checkout flow', async () => {
    renderWithProviders(<CartDrawer />);

    // Add items
    const addButton = screen.getByRole('button', { name: /add to cart/i });
    fireEvent.click(addButton);

    // Go to checkout
    const checkoutButton = screen.getByRole('button', { name: /checkout/i });
    await waitFor(() => expect(checkoutButton).toBeEnabled());
    fireEvent.click(checkoutButton);

    // Verify navigation
    expect(window.location.pathname).toBe('/consumer/checkout');
  });
});
```

## E2E Testing

### E2E Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/consumer/shop');
  });

  test('consumer can complete checkout', async ({ page }) => {
    // Add product to cart
    await page.click('button:has-text("Add to Cart")');
    
    // Go to checkout
    await page.click('button:has-text("Checkout")');
    
    // Fill delivery information
    await page.fill('input[name="deliveryAddress"]', '123 Main St');
    await page.fill('input[name="deliveryDate"]', '2025-12-01');
    
    // Complete payment
    await page.click('button:has-text("Pay Now")');
    
    // Verify success
    await expect(page).toHaveURL(/\/consumer\/order-success/);
    await expect(page.locator('text=Order Confirmed')).toBeVisible();
  });
});
```

### Running E2E Tests

```bash
# All tests
npm run test:e2e

# Specific test file
npx playwright test e2e/checkout-flow.spec.ts

# With UI
npm run test:e2e:ui

# Debug mode
npx playwright test --debug
```

## Edge Function Testing

### Unit Testing Edge Functions

```typescript
import { describe, it, expect, beforeEach } from 'https://deno.land/std@0.192.0/testing/bdd.ts';
import { withAuth } from '../middleware/withAuth.ts';

describe('withAuth', () => {
  it('should reject requests without authorization header', async () => {
    const mockHandler = async () => new Response('OK');
    const handler = withAuth(mockHandler);
    
    const req = new Request('https://test.com');
    const ctx = { supabase: mockSupabase };
    
    const response = await handler(req, ctx);
    expect(response.status).toBe(401);
  });
});
```

### Integration Testing Edge Functions

```typescript
import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

Deno.test('checkout: full flow', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/checkout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${testToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deliveryDate: '2025-12-01',
      deliveryAddress: 'Test Address',
    }),
  });
  
  assertEquals(response.status, 200);
});
```

## Performance Testing

### Benchmark Tests

```bash
# Run performance benchmarks
npm run test:performance

# Results include:
# - Function execution time
# - Memory usage
# - CPU utilization
```

### Load Testing

```bash
# Run load tests
npm run loadtest

# Or individual scripts:
node scripts/loadtest-checkout.js
node scripts/loadtest-batches.js
node scripts/loadtest-edge-functions.js
```

## Test Coverage Status

### ✅ Unit Tests (High Coverage)

**Business Logic:**
- ✅ Money formatting
- ✅ Credits system
- ✅ Delivery fees & revenue split
- ✅ Driver expense estimation
- ✅ Address helpers
- ✅ Distance calculations
- ✅ Order helpers
- ✅ Rating helpers
- ✅ Market helpers
- ✅ Image helpers
- ✅ CSV parser
- ✅ PDF generator

**React Hooks:**
- ✅ useCart
- ✅ useActiveOrder
- ✅ useShopProducts
- ✅ useProductSearch

**Components:**
- ✅ OrderTracking
- ✅ ProductCard
- ✅ CartDrawer

### ✅ Integration Tests

**Features:**
- ✅ Cart workflow (add, remove, checkout)
- ✅ Order creation and tracking
- ✅ Product filtering and search

**Edge Functions:**
- ✅ Checkout flow
- ✅ Stripe webhooks
- ✅ Payout processing
- ✅ Batch generation

### ✅ E2E Tests (Critical Paths)

**User Workflows:**
- ✅ Consumer checkout flow
- ✅ Driver route claiming and delivery
- ✅ Farmer product management
- ✅ Admin user approval
- ✅ Subscription management
- ✅ Order cutoff timing
- ✅ Consumer referral system

## Best Practices

### DO:
- ✅ Write tests for all new features
- ✅ Use test factories for consistent data
- ✅ Mock external dependencies (Supabase, Stripe)
- ✅ Test error scenarios
- ✅ Test edge cases
- ✅ Keep tests isolated and independent
- ✅ Use descriptive test names

### DON'T:
- ❌ Test implementation details
- ❌ Write flaky tests
- ❌ Skip cleanup in afterEach
- ❌ Use real API keys in tests
- ❌ Test third-party library functionality
- ❌ Share state between tests
- ❌ Hardcode test data

## CI/CD Integration

Tests run automatically on:
- **Pull Requests**: All unit and integration tests
- **Nightly**: Full E2E suite + load tests
- **Pre-deployment**: Smoke tests

### GitHub Actions Workflows

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:e2e
```

## Debugging Tests

### Failed Tests

```bash
# Run specific test
npm test -- src/lib/__tests__/formatMoney.test.ts

# Run with verbose output
npm test -- --reporter=verbose

# Run in debug mode
node --inspect-brk node_modules/.bin/vitest
```

### E2E Test Debugging

```bash
# Run with UI
npx playwright test --ui

# Debug mode (pause on failure)
npx playwright test --debug

# View trace
npx playwright show-trace trace.zip
```

## Related Documentation

- [Middleware Pattern](./MIDDLEWARE.md)
- [Monitoring Guide](./MONITORING.md)
- [Performance Optimization](./PERFORMANCE-OPTIMIZATION.md)
- [Testing Edge Functions](./TESTING-EDGE-FUNCTIONS.md)
