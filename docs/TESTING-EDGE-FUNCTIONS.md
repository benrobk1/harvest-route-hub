# Edge Function Testing Guide

## Overview

This guide covers testing strategies for Supabase Edge Functions using the middleware pattern.

## Test Structure

```
supabase/functions/
├── __tests__/
│   ├── middleware.test.ts              # Unit tests for middleware
│   ├── integration/
│   │   ├── checkout.integration.test.ts
│   │   ├── process-payouts.integration.test.ts
│   │   └── claim-route.integration.test.ts
│   └── helpers/
│       ├── testHelpers.ts
│       └── mockData.ts
```

## Running Tests

### Run all edge function tests
```bash
cd supabase/functions
deno test --allow-all __tests__/
```

### Run specific test file
```bash
deno test --allow-all __tests__/middleware.test.ts
```

### Run with coverage
```bash
deno test --allow-all --coverage=coverage __tests__/
deno coverage coverage
```

### Watch mode
```bash
deno test --allow-all --watch __tests__/
```

## Unit Testing Middleware

### Testing Individual Middleware

```typescript
import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { withRequestId } from '../_shared/middleware/withRequestId.ts';
import type { RequestIdContext } from '../_shared/middleware/withRequestId.ts';

Deno.test('withRequestId - generates unique request ID', async () => {
  let capturedContext: RequestIdContext | undefined;
  
  const handler = withRequestId(async (req, ctx) => {
    capturedContext = ctx;
    return new Response('OK');
  });

  const req = new Request('https://test.com/test');
  await handler(req, {});

  assertExists(capturedContext.requestId);
  assertEquals(typeof capturedContext.requestId, 'string');
  assertEquals(capturedContext.requestId.length, 36); // UUID
});
```

### Testing Error Handling

```typescript
Deno.test('withErrorHandling - catches errors', async () => {
  const handler = withErrorHandling(async () => {
    throw new Error('Test error');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, 'Test error');
});
```

### Testing Validation

```typescript
import { withValidation } from '../_shared/middleware/withValidation.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const TestSchema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
});

Deno.test('withValidation - validates input', async () => {
  const handler = withValidation(TestSchema)(async (req, ctx) => {
    return new Response(JSON.stringify(ctx.input), {
      headers: { 'Content-Type': 'application/json' }
    });
  });

  const validReq = new Request('https://test.com/test', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', amount: 100 })
  });

  const response = await handler(validReq, { corsHeaders: {} });
  assertEquals(response.status, 200);
});

Deno.test('withValidation - rejects invalid input', async () => {
  const handler = withValidation(TestSchema)(async (req, ctx) => {
    return new Response(JSON.stringify(ctx.input), {
      headers: { 'Content-Type': 'application/json' }
    });
  });

  const invalidReq = new Request('https://test.com/test', {
    method: 'POST',
    body: JSON.stringify({ email: 'invalid', amount: -5 })
  });

  const response = await handler(invalidReq, { corsHeaders: {} });
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, 'VALIDATION_ERROR');
});
```

## Integration Testing

### Testing Complete Edge Functions

```typescript
import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/checkout`;

Deno.test({
  name: 'Checkout - requires authentication',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart_id: 'test-cart-id',
        delivery_date: new Date().toISOString(),
      }),
    });

    assertEquals(response.status, 401);
  },
});
```

### Testing with Mock Data

```typescript
// __tests__/helpers/mockData.ts
export const createMockUser = () => ({
  id: crypto.randomUUID(),
  email: `test-${Date.now()}@example.com`,
  role: 'consumer',
});

export const createMockCart = (userId: string) => ({
  id: crypto.randomUUID(),
  user_id: userId,
  items: [
    {
      product_id: crypto.randomUUID(),
      quantity: 2,
      price: 10.00,
    }
  ],
});

// Use in tests
import { createMockUser, createMockCart } from './helpers/mockData.ts';

Deno.test('Checkout - processes valid cart', async () => {
  const user = createMockUser();
  const cart = createMockCart(user.id);
  
  // ... test logic ...
});
```

## Testing Best Practices

### 1. Test Isolation
Each test should be independent and not rely on external state:

```typescript
Deno.test('each test is isolated', async () => {
  // Setup
  const testData = createTestData();
  
  // Execute
  const result = await functionUnderTest(testData);
  
  // Verify
  assertEquals(result.success, true);
  
  // Cleanup (if needed)
  await cleanupTestData(testData.id);
});
```

### 2. Mock External Dependencies
Use mocks for external services:

```typescript
// Mock Supabase client
const mockSupabase = {
  from: () => ({
    select: () => Promise.resolve({ data: mockData, error: null }),
    insert: () => Promise.resolve({ data: mockData, error: null }),
  }),
  rpc: () => Promise.resolve({ data: true, error: null }),
};
```

### 3. Test Error Paths
Always test both success and failure scenarios:

```typescript
Deno.test('handles database errors gracefully', async () => {
  const mockSupabaseWithError = {
    from: () => ({
      select: () => Promise.resolve({ 
        data: null, 
        error: { message: 'Database error' } 
      }),
    }),
  };
  
  const response = await handler(req, { supabase: mockSupabaseWithError });
  assertEquals(response.status, 500);
});
```

### 4. Test Rate Limiting

```typescript
Deno.test('enforces rate limits', async () => {
  const user = createMockUser();
  const token = await createToken(user);

  // Make requests until rate limit is hit
  const requests = Array(12).fill(null).map(() =>
    fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validPayload),
    })
  );

  const responses = await Promise.all(requests);
  const rateLimited = responses.filter(r => r.status === 429);
  
  assertEquals(rateLimited.length > 0, true);
});
```

### 5. Test CORS Headers

```typescript
Deno.test('includes CORS headers', async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
  });

  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertExists(response.headers.get('Access-Control-Allow-Headers'));
});
```

## Testing Checklist

For each edge function, ensure you have tests for:

- [ ] Authentication (valid token, invalid token, missing token)
- [ ] Authorization (correct role, incorrect role)
- [ ] Input validation (valid input, invalid input, missing fields)
- [ ] Rate limiting (normal usage, rate limit exceeded)
- [ ] CORS headers (OPTIONS preflight, actual requests)
- [ ] Error handling (database errors, external API errors)
- [ ] Business logic (success path, edge cases)
- [ ] Performance (response time within acceptable range)

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Edge Function Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    paths:
      - 'supabase/functions/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      
      - name: Run tests
        run: |
          cd supabase/functions
          deno test --allow-all __tests__/
      
      - name: Run coverage
        run: |
          cd supabase/functions
          deno test --allow-all --coverage=coverage __tests__/
          deno coverage coverage
```

## Performance Testing

### Load Testing

```typescript
// scripts/loadtest-edge-function.ts
import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';

const CONCURRENT_REQUESTS = 100;
const TOTAL_REQUESTS = 1000;

async function loadTest() {
  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
    const batch = Array(CONCURRENT_REQUESTS).fill(null).map(() =>
      fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      })
    );

    const responses = await Promise.all(batch);
    results.push(...responses);
  }

  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.status < 400).length;
  
  console.log(`
    Total Requests: ${TOTAL_REQUESTS}
    Successful: ${successCount}
    Failed: ${TOTAL_REQUESTS - successCount}
    Duration: ${duration}ms
    Requests/sec: ${(TOTAL_REQUESTS / (duration / 1000)).toFixed(2)}
  `);
}

loadTest();
```

## Debugging Test Failures

### Enable Verbose Logging

```bash
deno test --allow-all --log-level=debug __tests__/
```

### Debug Specific Test

```typescript
Deno.test('debug specific scenario', async () => {
  console.log('Starting test...');
  
  const response = await handler(req, ctx);
  console.log('Response status:', response.status);
  console.log('Response body:', await response.text());
  
  assertEquals(response.status, 200);
});
```

### Use Deno Inspector

```bash
deno test --allow-all --inspect-brk __tests__/middleware.test.ts
# Then open chrome://inspect in Chrome
```

## Related Documentation

- [MIDDLEWARE.md](../supabase/functions/MIDDLEWARE.md) - Middleware reference
- [MONITORING-GUIDE.md](./MONITORING-GUIDE.md) - Monitoring and observability
- [TESTING-GUIDE.md](./TESTING-GUIDE.md) - Frontend testing guide
