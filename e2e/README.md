# E2E Testing Guide

## Overview

This directory contains end-to-end tests for the BlueHarvests application using Playwright. The tests cover critical user flows across all role types: Consumer, Farmer, Driver, and Admin.

## Setup

### Install Dependencies

```bash
npm install
npx playwright install chromium
```

### Environment

Tests run against `http://localhost:8080` by default. The Playwright config automatically starts the dev server before running tests.

**Note:** If you encounter a different port, verify the `use.baseURL` and `webServer.url` settings in `playwright.config.ts` to ensure they match your development server configuration.

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/checkout-flow.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug
```

## Test Structure

### Directory Layout

```
e2e/
├── support/
│   ├── fixtures.ts         # Custom test fixtures and auth helpers
│   ├── helpers.ts          # Utility functions for common operations
│   ├── playwright.ts       # Conditional Playwright import
│   └── global-setup.ts     # Global setup before all tests
├── admin-workflow.spec.ts
├── auth-roles.spec.ts
├── checkout-flow.spec.ts
├── consumer-referral.spec.ts
├── driver-workflow.spec.ts
├── farmer-workflow.spec.ts
├── order-cutoff.spec.ts
└── subscription-flow.spec.ts
```

### Test Files

- **admin-workflow.spec.ts** - Admin dashboard, user approvals, product approvals, analytics
- **auth-roles.spec.ts** - Role-based access control and authentication
- **checkout-flow.spec.ts** - Consumer checkout process
- **consumer-referral.spec.ts** - Referral system functionality
- **driver-workflow.spec.ts** - Driver dashboard and delivery management
- **farmer-workflow.spec.ts** - Farmer dashboard, inventory, and financials
- **order-cutoff.spec.ts** - Order cutoff time enforcement
- **subscription-flow.spec.ts** - Subscription management

## Writing Tests

### Using Fixtures

Tests have access to custom fixtures that make common operations easier:

```typescript
import { test, expect } from './support/fixtures';

test('my test', async ({ page, auth }) => {
  // Use auth helper to sign up or login
  await auth.signUp('consumer');

  // Use page for navigation and interaction
  await page.goto('/consumer/shop');
});
```

### Authentication Helper

The `auth` fixture provides convenient methods:

```typescript
// Sign up a new user with auto-generated unique email
const { email, password } = await auth.signUp('consumer');
const { email, password } = await auth.signUp('farmer');
const { email, password } = await auth.signUp('driver');
const { email, password } = await auth.signUp('admin');

// Login existing user
await auth.login('user@example.com', 'password', 'consumer');

// Logout
await auth.logout();
```

### Using Helpers

Import helper functions for common operations:

```typescript
import {
  navigateAndWait,
  waitForPageReady,
  addProductToCart,
  goToCheckout,
  expectToast,
  generateTestEmail
} from './support/helpers';

test('add to cart', async ({ page, auth }) => {
  await auth.signUp('consumer');

  // Navigate and wait for page to be ready
  await navigateAndWait(page, '/consumer/shop');

  // Add product to cart
  await addProductToCart(page);

  // Verify success toast
  await expectToast(page, 'Added to cart', 'success');
});
```

### Best Practices

1. **Use unique emails for each test** - The auth helper automatically generates unique emails to avoid conflicts
2. **Wait for network idle** - Use `waitForPageReady()` or `navigateAndWait()` instead of arbitrary timeouts
3. **Use flexible selectors** - Prefer data-testid attributes, fallback to text or role-based selectors
4. **Add descriptive test names** - Test names should clearly describe what is being tested
5. **Keep tests isolated** - Each test should be independent and not rely on other tests
6. **Use proper assertions** - Always verify expected outcomes with `expect()` statements

### Selector Strategy

Tests use a layered selector strategy for robustness:

```typescript
// Primary: data-testid attributes (most stable)
await page.locator('[data-testid="product-card"]')

// Secondary: Semantic selectors (accessible)
await page.getByRole('button', { name: /checkout/i })

// Tertiary: Text content (flexible)
await page.getByText(/shop|products/i)

// Fallback: Class/CSS selectors (last resort)
await page.locator('.product-card')
```

## Debugging Tests

### View Test Reports

After tests run, view the HTML report:

```bash
npx playwright show-report
```

### Debug Specific Test

```bash
npx playwright test --debug e2e/checkout-flow.spec.ts
```

### Enable Trace Viewer

Traces are automatically captured on first retry. View them:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

### Enable Verbose Logging

```bash
DEBUG=pw:api npx playwright test
```

## CI/CD Integration

Tests are configured for CI environments:

- Automatic retries (2x)
- Headless mode
- Parallel execution (2 workers)
- Multiple reporters (HTML, JSON, JUnit)

## Troubleshooting

### Tests timeout waiting for server

Increase timeout in `playwright.config.ts`:

```typescript
webServer: {
  timeout: 120000, // 2 minutes
}
```

### Element not found

1. Check if the element exists in the app
2. Add wait strategy: `await page.waitForSelector(...)`
3. Use flexible selectors with multiple fallbacks
4. Verify the page has finished loading: `await waitForPageReady(page)`

### Authentication issues

1. Ensure dev server has proper Supabase configuration
2. Check `.env` file has valid credentials
3. Verify unique emails are being used (handled automatically by `auth.signUp()`)

### Tests fail in CI but pass locally

1. Check timing issues - add proper waits instead of timeouts
2. Verify environment variables are set in CI
3. Ensure database is accessible from CI environment

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
