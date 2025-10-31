# Testing Guide

This project includes comprehensive testing setup with Vitest and Playwright.

## Test Coverage

### E2E Tests (Playwright)
- ✅ Consumer checkout flow (`e2e/checkout-flow.spec.ts`)
- ✅ Role-based access control (`e2e/auth-roles.spec.ts`)
- ✅ Order cutoff enforcement (`e2e/order-cutoff.spec.ts`)
- ✅ Driver workflow (`e2e/driver-workflow.spec.ts`)

### Unit Tests (Vitest)
- ✅ Money formatting (`src/lib/__tests__/formatMoney.test.ts`)
- ✅ Credits system (`src/lib/__tests__/creditsHelpers.test.ts`)
- ✅ Delivery fees & revenue split (`src/lib/__tests__/deliveryFeeHelpers.test.ts`)
- ✅ Driver expense estimation (`src/lib/__tests__/driverEarningsHelpers.test.ts`)

**Current Coverage:** ~60% (business logic + critical paths)

---

## Unit Tests (Vitest)

Run unit tests:
```bash
npm run test
# or
npx vitest
```

Run tests with UI:
```bash
npm run test:ui
# or
npx vitest --ui
```

Run tests with coverage:
```bash
npm run test:coverage
# or
npx vitest --coverage
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
});
```

## E2E Tests (Playwright)

Run e2e tests:
```bash
npx playwright test
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
