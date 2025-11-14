# Edge Functions Middleware Pattern

**Status**: ✅ Production Ready | All 21 edge functions migrated  
**Last Updated**: November 2025

## Overview

This document covers the standardized middleware pattern used across all Supabase Edge Functions. The middleware architecture provides consistent authentication, validation, rate limiting, error handling, and observability.

## Architecture

### Middleware Signature

```typescript
type Middleware<T = any> = (
  handler: (req: Request, ctx: T) => Promise<Response>
) => (req: Request, ctx: T) => Promise<Response>;
```

Each middleware is a higher-order function that:
1. Takes a handler function as input
2. Returns a new handler function with added functionality
3. Can access and modify the context object

### Execution Flow

Middleware executes in layers from outermost to innermost:

```
Request → Error Handling → Request ID → CORS → Auth → Rate Limit → Validation → Business Logic → Response
```

### Composition Pattern

Use `createMiddlewareStack` for consistent middleware composition:

```typescript
import { createMiddlewareStack } from '../_shared/middleware/compose.ts';
import { 
  withRequestId, 
  withCORS, 
  withAuth, 
  withRateLimit,
  withValidation,
  withErrorHandling 
} from '../_shared/middleware/index.ts';

type Context = RequestIdContext & 
                CORSContext & 
                AuthContext & 
                ValidationContext<YourInputSchema>;

const middlewareStack = createMiddlewareStack<Context>([
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.YOUR_ENDPOINT),
  withValidation(YourRequestSchema),
  withErrorHandling,
]);

serve((req) => middlewareStack(handler)(req, {} as any));
```

## Available Middleware

### 1. withErrorHandling

Catches all unhandled errors and returns structured error responses.

```typescript
import { withErrorHandling } from '../_shared/middleware/index.ts';

const handler = withErrorHandling(async (req, ctx) => {
  // Your logic here - errors are automatically caught
  return new Response('OK');
});
```

**Provides:**
- Global error catching
- Structured error responses
- Error logging with request ID
- Sentry integration (if configured)

---

### 2. withRequestId

Generates unique request IDs for correlated logging.

```typescript
import { withRequestId } from '../_shared/middleware/index.ts';

const handler = withRequestId(async (req, ctx) => {
  console.log(`[${ctx.requestId}] Processing request`);
  return new Response('OK');
});
```

**Provides:**
- `ctx.requestId: string` - Unique UUID for this request
- Automatic request start/complete logging
- Request duration tracking

---

### 3. withCORS

Handles CORS headers and OPTIONS requests.

```typescript
import { withCORS } from '../_shared/middleware/index.ts';

const handler = withCORS(async (req, ctx) => {
  // CORS already handled
  return new Response('OK');
});
```

**Provides:**
- `ctx.corsHeaders: Record<string, string>` - Standard CORS headers
- Automatic OPTIONS request handling
- CORS headers attached to all responses

---

### 4. withAuth

Validates JWT tokens and attaches authenticated user to context.

```typescript
import { withAuth } from '../_shared/middleware/index.ts';

const handler = withAuth(async (req, ctx) => {
  console.log('Authenticated user:', ctx.user.id);
  return new Response('OK');
});
```

**Context Requirements:**
- `ctx.supabase: SupabaseClient` (must be initialized before withAuth)

**Provides:**
- `ctx.user: User` - Authenticated Supabase user object
- Returns 401 if token is missing or invalid

---

### 5. withAdminAuth

Validates user has admin role.

```typescript
import { withAdminAuth } from '../_shared/middleware/index.ts';

const handler = withAdminAuth(async (req, ctx) => {
  // User is verified admin
  return new Response('OK');
});
```

**Context Requirements:**
- `ctx.user: User` (from withAuth)
- `ctx.supabase: SupabaseClient`

**Provides:**
- Admin role verification via `has_role` RPC
- Returns 403 if user is not an admin

**Important:** Must be used AFTER `withAuth`

---

### 6. withDriverAuth

Validates user has driver role.

```typescript
import { withDriverAuth } from '../_shared/middleware/index.ts';

const handler = withDriverAuth(async (req, ctx) => {
  // User is verified driver
  return new Response('OK');
});
```

**Context Requirements:**
- `ctx.user: User` (from withAuth)
- `ctx.supabase: SupabaseClient`

**Provides:**
- Driver role verification
- Returns 403 if user is not a driver

---

### 7. withRateLimit

Prevents abuse with configurable rate limits.

```typescript
import { withRateLimit } from '../_shared/middleware/index.ts';
import { RATE_LIMITS } from '../_shared/rateLimiter.ts';

const handler = withRateLimit(RATE_LIMITS.CHECKOUT)(
  async (req, ctx) => {
    // Rate limit already checked
    return new Response('OK');
  }
);
```

**Context Requirements:**
- `ctx.user: User` (from withAuth)
- `ctx.supabase: SupabaseClient`

**Provides:**
- Per-user rate limiting
- Returns 429 if limit exceeded
- Automatic cleanup of old rate limit records

**Available Rate Limits:**
```typescript
RATE_LIMITS.CHECKOUT         // 10 req / 15 min
RATE_LIMITS.PAYOUT           // 1 req / 5 min
RATE_LIMITS.PUSH_NOTIFICATION // 20 req / hour
RATE_LIMITS.GENERAL          // 100 req / min
```

---

### 8. withValidation

Validates request body with Zod schemas.

```typescript
import { withValidation } from '../_shared/middleware/index.ts';
import { z } from 'zod';

const MySchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
});

const handler = withValidation(MySchema)(
  async (req, ctx) => {
    // ctx.input is typed and validated
    const { orderId, amount } = ctx.input;
    return new Response('OK');
  }
);
```

**Provides:**
- `ctx.input: T` - Validated and typed request body
- Returns 400 if validation fails
- Detailed validation error messages

---

### 9. withMetrics

Tracks performance and logs metrics.

```typescript
import { withMetrics } from '../_shared/middleware/index.ts';

const handler = withMetrics('my-function')(
  async (req, ctx) => {
    ctx.metrics.mark('validation_complete');
    ctx.metrics.mark('processing_complete');
    return new Response('OK');
  }
);
```

**Provides:**
- `ctx.metrics` - Metrics collector
- Automatic request duration tracking
- Performance checkpoint markers
- Structured metric logs

## Common Patterns

### Public Endpoint (No Auth)

```typescript
const middlewareStack = createMiddlewareStack<RequestIdContext & CORSContext>([
  withRequestId,
  withCORS,
  withErrorHandling,
]);
```

### Authenticated User Endpoint

```typescript
const middlewareStack = createMiddlewareStack<
  RequestIdContext & CORSContext & AuthContext & ValidationContext<InputSchema>
>([
  withRequestId,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.GENERAL),
  withValidation(InputSchema),
  withErrorHandling,
]);
```

### Admin-Only Endpoint

```typescript
const middlewareStack = createMiddlewareStack<
  RequestIdContext & CORSContext & AuthContext & ValidationContext<InputSchema>
>([
  withRequestId,
  withCORS,
  withAuth,
  withAdminAuth,
  withRateLimit(RATE_LIMITS.GENERAL),
  withValidation(InputSchema),
  withErrorHandling,
]);
```

### Driver-Only Endpoint

```typescript
const middlewareStack = createMiddlewareStack<
  RequestIdContext & CORSContext & AuthContext & ValidationContext<InputSchema>
>([
  withRequestId,
  withCORS,
  withAuth,
  withDriverAuth,
  withRateLimit(RATE_LIMITS.GENERAL),
  withValidation(InputSchema),
  withErrorHandling,
]);
```

## Structured Logging

All middleware automatically logs in structured JSON format:

### Request Metrics
```json
{
  "type": "metrics",
  "requestId": "abc-123-def",
  "functionName": "checkout",
  "statusCode": 200,
  "durationMs": 245,
  "userId": "user-456",
  "metadata": {
    "markers": [
      { "name": "auth_complete", "timestamp": 45 },
      { "name": "validation_complete", "timestamp": 78 }
    ]
  }
}
```

### Business Events
```json
{
  "type": "business_event",
  "requestId": "abc-123-def",
  "eventType": "order_created",
  "details": {
    "orderId": "order-789",
    "totalAmount": 125.50
  }
}
```

### Security Events
```json
{
  "type": "security_event",
  "requestId": "abc-123-def",
  "eventType": "rate_limit_exceeded",
  "userId": "user-456"
}
```

## Testing

### Unit Testing Middleware

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

## Troubleshooting

### Context Type Errors

Ensure your context type includes all required middleware contexts:

```typescript
// ❌ Wrong
type Context = AuthContext;

// ✅ Correct
type Context = RequestIdContext & CORSContext & AuthContext;
```

### Middleware Order Issues

Middleware order matters - always follow this sequence:
1. `withRequestId` (first - needed for logging)
2. `withCORS` (early - handles OPTIONS)
3. `withAuth` (before role checks)
4. `withAdminAuth` / `withDriverAuth` (after auth)
5. `withRateLimit` (after auth)
6. `withValidation` (before business logic)
7. `withErrorHandling` (last - catches all errors)

### Supabase Client Not Found

Initialize Supabase client before using auth middleware:

```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const ctx = { supabase };
```

## Migration Status

**All 21 edge functions successfully migrated:**

✅ checkout  
✅ process-payouts  
✅ claim-route  
✅ cancel-order  
✅ accept-invitation  
✅ invite-admin  
✅ award-credits  
✅ store-tax-info  
✅ generate-batches  
✅ optimize-delivery-batches  
✅ send-notification  
✅ check-stripe-connect  
✅ stripe-connect-onboard  
✅ stripe-webhook  
✅ send-push-notification  
✅ generate-1099  
✅ check-subscription  
✅ create-subscription-checkout  
✅ seed-test-users  
✅ send-cutoff-reminders  
✅ send-trial-reminders

## Related Documentation

- [Testing Edge Functions](./TESTING-EDGE-FUNCTIONS.md)
- [Monitoring Guide](./MONITORING.md)
- [Security Hardening](./SECURITY-HARDENING.md)
- [Architecture Guide](../ARCHITECTURE.md)
