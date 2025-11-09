# Comprehensive Testing Guide

## Table of Contents
1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Performance Testing](#performance-testing)
7. [Test Coverage](#test-coverage)
8. [CI/CD Integration](#cicd-integration)
9. [Best Practices](#best-practices)

## Overview

This project follows a comprehensive testing strategy covering:
- **Unit Tests**: Individual functions, hooks, and utilities
- **Integration Tests**: Feature workflows and component interactions
- **E2E Tests**: Full user journeys across the application
- **Performance Tests**: Load testing and benchmarking
- **Edge Function Tests**: Backend logic and API endpoints

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

## Unit Testing

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:unit

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/lib/__tests__/formatMoney.test.ts

# Run tests matching pattern
npm test -- --grep "cart"
```

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

    // Proceed to checkout
    const checkoutButton = await screen.findByRole('button', { name: /checkout/i });
    fireEvent.click(checkoutButton);

    // Verify navigation
    await waitFor(() => {
      expect(window.location.pathname).toBe('/checkout');
    });
  });
});
```

## E2E Testing

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific browser
npx playwright test --project=chromium

# Run specific test file
npx playwright test e2e/checkout-flow.spec.ts

# Debug mode
npx playwright test --debug

# Run in UI mode
npx playwright test --ui
```

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Consumer Checkout Flow', () => {
  test('should complete purchase successfully', async ({ page }) => {
    // Navigate to shop
    await page.goto('/');
    
    // Add item to cart
    await page.click('[data-testid="add-to-cart-123"]');
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
    
    // Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL(/\/checkout/);
    
    // Fill payment form
    await page.fill('[name="cardNumber"]', '4242424242424242');
    await page.fill('[name="expiry"]', '12/25');
    await page.fill('[name="cvc"]', '123');
    
    // Submit order
    await page.click('[data-testid="place-order"]');
    
    // Verify success
    await expect(page.locator('text=Order confirmed')).toBeVisible();
  });
});
```

### E2E Best Practices

1. **Use Data Attributes**: Prefer `data-testid` over class names
2. **Wait for Elements**: Use `waitFor` or `expect.toBeVisible()`
3. **Isolate Tests**: Each test should be independent
4. **Clean Up**: Remove test data after each test
5. **Mock External Services**: Use MSW for API mocking

## Performance Testing

### Load Testing

Run load tests to verify system capacity:

```bash
# Batch generation load test
node scripts/loadtest-batches.js

# Checkout flow load test
node scripts/loadtest-checkout.js
```

### Performance Benchmarks

Measure baseline performance:

```bash
node scripts/performance-benchmark.js
```

### Performance Targets

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Simple Query | < 100ms | < 200ms |
| Complex Query | < 500ms | < 1000ms |
| Edge Function | < 1000ms | < 2000ms |
| Page Load | < 2s | < 3s |
| 95th Percentile | < 3s | < 5s |

### Monitoring Performance

```typescript
// Add performance marks in code
performance.mark('checkout-start');
await processCheckout();
performance.mark('checkout-end');
performance.measure('checkout', 'checkout-start', 'checkout-end');

const measure = performance.getEntriesByName('checkout')[0];
console.log(`Checkout took ${measure.duration}ms`);
```

## Test Coverage

### Coverage Thresholds

Current thresholds (70%):
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Exclusions

The following are excluded from coverage:
- `node_modules/`
- `src/test/`
- Type definition files (`.d.ts`)
- Config files
- Auto-generated files (`src/integrations/supabase/`)
- UI component library (`src/components/ui/`)

### Improving Coverage

1. **Identify Gaps**: Check HTML report for uncovered lines
2. **Prioritize Critical Paths**: Focus on business logic first
3. **Add Edge Cases**: Test error conditions and boundaries
4. **Mock Dependencies**: Isolate units properly
5. **Update Thresholds**: Gradually increase as coverage improves

## CI/CD Integration

### GitHub Actions Workflows

#### CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and PR:
- Type checking
- Linting
- Unit tests with coverage
- E2E tests (parallel)
- Edge function tests

```bash
# Triggered automatically on push/PR
# Or manually run locally:
npm run lint
npm run test:coverage
npx playwright test
```

#### Nightly Workflow (`.github/workflows/nightly.yml`)

Comprehensive tests every night at 2 AM UTC:
- Full test suite
- Extended E2E scenarios
- Performance benchmarks

### Local Pre-commit Checks

```bash
# Run full local validation
npm run lint && npm run test:coverage && npm run test:e2e
```

## Best Practices

### General Testing Principles

1. **Arrange-Act-Assert**: Structure tests clearly
2. **One Assertion per Test**: Keep tests focused
3. **Descriptive Names**: Use clear, specific test names
4. **Test Behavior**: Test what, not how
5. **Avoid Implementation Details**: Don't test internals

### Test Organization

```typescript
describe('Feature: Cart Management', () => {
  describe('Adding Items', () => {
    it('should add single item to empty cart', () => {});
    it('should increment quantity for duplicate item', () => {});
    it('should validate available quantity', () => {});
  });

  describe('Removing Items', () => {
    it('should remove item from cart', () => {});
    it('should clear cart when removing last item', () => {});
  });
});
```

### Mock Strategy

1. **Mock at Boundaries**: Mock external dependencies only
2. **Keep Mocks Simple**: Avoid complex mock logic
3. **Verify Mock Calls**: Check interactions when relevant
4. **Reset Between Tests**: Clear mocks in `beforeEach`

### Common Pitfalls

❌ **Don't**:
- Test implementation details
- Write tests that depend on other tests
- Use hardcoded timeouts extensively
- Mock everything (over-mocking)
- Ignore flaky tests

✅ **Do**:
- Test user-facing behavior
- Make tests independent and isolated
- Use proper wait utilities
- Mock only external dependencies
- Fix flaky tests immediately

### Debugging Tests

```bash
# Run single test in debug mode
npm test -- --no-coverage src/lib/__tests__/formatMoney.test.ts

# E2E debug mode
npx playwright test --debug

# Show browser during E2E
npx playwright test --headed

# Slow down execution
npx playwright test --slow-mo=1000
```

### Test Data Management

```typescript
// Use factories for consistency
const user = createTestUser({ role: 'consumer' });
const product = createTestProduct({ price: 10.99 });
const order = createTestOrder({ 
  consumer_id: user.id,
  items: [{ product_id: product.id, quantity: 2 }]
});

// Clean up after tests
afterEach(async () => {
  await cleanupTestData([user.id, order.id]);
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Deno Testing](https://deno.land/manual/testing)

## Support

For questions or issues with testing:
1. Check this guide first
2. Review existing test files for examples
3. Consult framework documentation
4. Ask the team in Slack #engineering
