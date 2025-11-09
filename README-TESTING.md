# Testing Guide

This project includes comprehensive testing setup with Vitest for unit tests, Playwright for E2E tests, and code coverage reporting.

## 📊 Code Coverage

### Running Coverage Reports

Generate coverage report:
```bash
npm run test:coverage
```

View coverage in your browser:
```bash
npm run test:coverage
# Open coverage/index.html in your browser
```

Interactive coverage with UI:
```bash
npm run test:coverage:ui
```

### Coverage Thresholds

The project enforces minimum coverage thresholds:
- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

### Coverage Configuration

Coverage is configured in `vitest.config.ts`:

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

### Reading Coverage Reports

**Terminal Output:**
```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------------|---------|----------|---------|---------|-------------------
src/lib/formatMoney.ts  |   100   |   100    |   100   |   100   |
src/lib/creditsHelpers  |   95.5  |   90     |   100   |   95.5  | 23-25
```

**HTML Report:**
- Open `coverage/index.html` in browser
- Navigate through files to see line-by-line coverage
- Red lines = uncovered code
- Green lines = covered code
- Yellow lines = partially covered branches

### Improving Coverage

**Identify untested code:**
```bash
npm run test:coverage
# Review HTML report at coverage/index.html
```

**Add tests for critical paths:**
1. Business logic in `src/lib/`
2. Feature hooks in `src/features/*/hooks/`
3. Custom React hooks in `src/hooks/`
4. Service classes in backend

**Example: Adding a test for uncovered code**
```typescript
// Found uncovered function in coverage report
describe('calculateDeliveryFee', () => {
  it('returns correct fee for standard delivery', () => {
    expect(calculateDeliveryFee('10001', mockConfig)).toBe(7.50);
  });
  
  it('handles invalid ZIP codes', () => {
    expect(() => calculateDeliveryFee('', mockConfig)).toThrow();
  });
});
```

## Test Coverage

### Unit Tests Coverage Status

#### Business Logic (High Coverage Priority)
- ✅ Money formatting (`src/lib/__tests__/formatMoney.test.ts`)
- ✅ Credits system (`src/lib/__tests__/creditsHelpers.test.ts`)
- ✅ Delivery fees & revenue split (`src/lib/__tests__/deliveryFeeHelpers.test.ts`)
- ✅ Driver expense estimation (`src/lib/__tests__/driverEarningsHelpers.test.ts`)
- ✅ Address helpers (`src/lib/__tests__/addressHelpers.test.ts`)
- ✅ Distance calculations (`src/lib/__tests__/distanceHelpers.test.ts`)
- ✅ Order helpers (`src/lib/__tests__/orderHelpers.test.ts`)
- ✅ Rating helpers (`src/lib/__tests__/ratingHelpers.test.ts`)
- ✅ Market helpers (`src/lib/__tests__/marketHelpers.test.ts`)
- ✅ Image helpers (`src/lib/__tests__/imageHelpers.test.ts`)
- ✅ CSV parser (`src/lib/__tests__/csvParser.test.ts`)
- ✅ PDF generator (`src/lib/__tests__/pdfGenerator.test.ts`)

#### Edge Functions Tests
- ✅ Checkout flow (`supabase/functions/__tests__/checkout.test.ts`)
- ✅ Stripe webhooks (`supabase/functions/__tests__/stripe-webhook.test.ts`)
- ✅ Payout processing (`supabase/functions/__tests__/process-payouts.test.ts`)
- ✅ Batch generation (`supabase/functions/__tests__/generate-batches.test.ts`)

#### Test Infrastructure
- ✅ Supabase mock (`src/test/mocks/supabase.ts`)
- ✅ Stripe mock (`src/test/mocks/stripe.ts`)
- ✅ Auth context mock (`src/test/mocks/authContext.ts`)
- ✅ User factory (`src/test/factories/userFactory.ts`)
- ✅ Product factory (`src/test/factories/productFactory.ts`)
- ✅ Order factory (`src/test/factories/orderFactory.ts`)
- ✅ Cart factory (`src/test/factories/cartFactory.ts`)
- ✅ Render with providers (`src/test/helpers/renderWithProviders.tsx`)

#### Feature Modules (To Add in Phase 2)
- ⏳ Cart operations (`src/features/cart/`)
- ⏳ Order management (`src/features/orders/`)
- ⏳ Product queries (`src/features/products/`)
- ⏳ Payout calculations (`src/features/payouts/`)

### E2E Tests Coverage
- ✅ Consumer checkout flow (`e2e/checkout-flow.spec.ts`)
- ✅ Role-based access control (`e2e/auth-roles.spec.ts`)
- ✅ Order cutoff enforcement (`e2e/order-cutoff.spec.ts`)
- ✅ Driver workflow (`e2e/driver-workflow.spec.ts`)

**Current Status:** Unit tests cover critical business logic. Coverage reports help identify gaps for future test additions.

---

## Unit Tests (Vitest)

### Running Tests

Run all tests:
```bash
npm test
```

Run specific test types:
```bash
# Unit tests for helper functions
npm run test:unit

# Component tests
npm run test:components

# Integration tests
npm run test:integration
```

Run tests in watch mode (for development):
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
npm run test:coverage:detailed  # HTML report
```

Run tests with UI:
```bash
npm run test:ui
# or
npx vitest --ui
```

### Writing Unit Tests

Unit tests are located in `src/**/__tests__/` directories. Example:

```typescript
import { describe, it, expect } from 'vitest';
import { formatMoney } from '../formatMoney';

describe('formatMoney', () => {
  it('formats amounts correctly', () => {
    expect(formatMoney(100)).toBe('$100.00');
  });
  
  it('handles edge cases', () => {
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(-50.25)).toBe('-$50.25');
  });
});
```

### Test Utilities

Use test mocks and factories for consistent test data:

```typescript
import { createMockSupabaseClient } from '@/test/mocks/supabase';
import { createMockProduct } from '@/test/factories/productFactory';
import { renderWithProviders } from '@/test/helpers/renderWithProviders';

// Mock Supabase client
const supabase = createMockSupabaseClient();

// Create test product
const product = createMockProduct({ price: 9.99 });

// Render component with providers
renderWithProviders(<ProductCard product={product} />);
```

## E2E Tests (Playwright)

Run e2e tests:
```bash
npm run test:e2e
# or
npx playwright test
```

Run only critical path tests:
```bash
npm run test:e2e:critical
```

Run tests in UI mode:
```bash
npx playwright test --ui
```

Run tests on specific browser:
```bash
npx playwright test --project=chromium
npx playwright test --project=mobile
```

### Writing E2E Tests

E2E tests are located in `e2e/` directory. Example:

```typescript
import { test, expect } from '@playwright/test';

test('user can checkout', async ({ page }) => {
  await page.goto('/consumer/shop');
  await page.getByRole('button', { name: /add to cart/i }).first().click();
  await expect(page.getByText(/1/)).toBeVisible();
});
```

## Edge Function Tests (Deno)

Edge functions use Deno's test runner:

```bash
npm run test:edge-functions
# or
cd supabase/functions && deno test --allow-env --allow-net __tests__/
```

Edge function tests validate:
- Authentication and authorization
- Rate limiting
- Input validation
- Business logic
- Error handling
- Integration with Stripe and other services

See `supabase/functions/__tests__/` for examples.

## Error Tracking (Sentry)

Sentry is configured for error tracking in production. To enable:

1. Add your Sentry DSN to `.env`:
```
VITE_SENTRY_DSN=your_sentry_dsn_here
```

2. For source maps upload (optional):
```
SENTRY_ORG=your_org
SENTRY_PROJECT=your_project
SENTRY_AUTH_TOKEN=your_auth_token
```

## Load Testing

The load test validates batch generation performance by creating real test orders in the database.

### Setup

1. Add your service role key to `.env`:
```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ **Security Note:** The service role key bypasses RLS and should only be used in local development. Never commit it to version control.

### Run Load Test

```bash
node scripts/loadtest-batches.js
```

Or if you've added npm scripts:
```bash
npm run test:load
```

### What It Tests

The load test:
1. ✅ Creates 40 test orders with real NYC addresses
2. ✅ Calls the `generate-batches` edge function
3. ✅ Measures performance and validates results
4. ✅ Automatically cleans up all test data

**Expected Performance:**
- ✅ 40 addresses batched in < 3 seconds
- 📦 4 batches created (10 orders per batch)
- 🎯 ~50ms per address average
- 🚀 Extrapolated capacity: ~1,300 orders/hour

**Example Output:**
```
🚀 Starting batch generation load test...

📊 Phase 1: Seeding test data...
✅ Created test consumer: abc-123-def
✅ Created 40 test orders

📦 Phase 2: Running batch generation...

✅ LOAD TEST RESULTS:
─────────────────────────────────────
⏱️  Duration: 1847ms (1.85s)
📦 Batches created: 4
🚚 Orders per batch: 10
🎯 Avg time per address: 46ms
─────────────────────────────────────
🎉 Performance Target: PASSED (< 3s)
✨ System can handle 40+ concurrent orders efficiently

📊 Extrapolated Capacity:
   - 21.7 orders/second
   - ~1,299 orders/minute
   - ~77,940 orders/hour

📍 Batch Details:
   - Batch 1: 10 stops
   - Batch 2: 10 stops
   - Batch 3: 10 stops
   - Batch 4: 10 stops

🧹 Cleaning up test data...
✅ Cleanup complete
```

Performance validated for high-volume order processing.

---

## Performance Indexes

Database indexes have been added for high-traffic queries:
- Orders by consumer and date
- Products by farm and availability
- Delivery batches by driver and status
- Cart items by cart ID
- Payouts by recipient and status

These indexes significantly improve query performance for:
- User dashboards
- Order tracking
- Delivery route optimization
- Financial reporting
