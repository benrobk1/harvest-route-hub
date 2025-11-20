# Edge Function Middleware Migration Guide

This guide explains how to refactor edge functions to use the middleware pattern demonstrated in `checkout/index.ts`.

## Table of Contents
- [Before and After Comparison](#before-and-after-comparison)
- [Benefits of Middleware Pattern](#benefits-of-middleware-pattern)
- [Step-by-Step Migration](#step-by-step-migration)
- [Middleware Layers](#middleware-layers)
- [Common Patterns](#common-patterns)
- [Testing](#testing)

---

## Before and After Comparison

### Before (Anti-pattern - see old versions)
```typescript
serve(async (req) => {
  try {
    const body = await req.json();
    // 50+ lines of auth, validation, rate limiting mixed with business logic
    const user = await getUser();
    if (!user) return errorResponse();
    
    const valid = validateInput(body);
    if (!valid) return errorResponse();
    
    // Business logic buried in middleware code
    const result = await doSomething();
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
});
```

### After (Middleware Pattern - see checkout/index.ts)
```typescript
serve(async (req) => {
  // 1. Request ID for correlated logging
  const requestId = crypto.randomUUID();
  
  try {
    // 2. Config loading
    const config = loadConfig();
    const supabase = createClient(/* ... */);
    
    // 3. Auth middleware
    const { user } = await authenticateRequest(req, supabase);
    
    // 4. Rate limiting
    await checkRateLimit(supabase, user.id, rateConfig);
    
    // 5. Input validation
    const input = validateRequest(body, schema);
    
    // 6. Business logic (clean and focused!)
    const result = await service.processRequest(input);
    
    return successResponse(result);
  } catch (error) {
    return handleError(error, requestId);
  }
});
```

---

## Benefits of Middleware Pattern

### 1. **DRY (Don't Repeat Yourself)**
- Auth logic written once in `_shared/middleware/`
- Reused across all edge functions
- Changes propagate automatically

### 2. **Testability**
- Each middleware layer is independently testable
- Business logic tested without auth/validation concerns
- Mock middleware for unit tests

### 3. **Maintainability**
- Clear separation of concerns
- Easy to add/remove middleware layers
- Obvious execution order

### 4. **Type Safety**
- TypeScript context types flow through middleware
- Compile-time guarantees about available data
- IDE autocomplete for context properties

### 5. **Observability**
- Request IDs for correlated logging
- Consistent log format across functions
- Easy to trace request lifecycle

---

## Step-by-Step Migration

### Step 1: Add Request ID Generation

**Purpose:** Correlate all logs for a single request

```typescript
serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] [FUNCTION_NAME] Request started`);
  
  try {
    // ... rest of function
    console.log(`[${requestId}] Processing step X`);
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
  }
});
```

**Benefits:**
- Trace request flow through logs
- Debug production issues
- Monitor performance

---

### Step 2: Extract Authentication

**Purpose:** Validate JWT and get authenticated user

```typescript
// Auth middleware layer
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ 
    error: 'UNAUTHORIZED',
    message: 'Missing authorization header'
  }), {
    status: 401,
    headers: corsHeaders,
  });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token);

if (error || !user) {
  console.error(`[${requestId}] Auth failed:`, error?.message);
  return new Response(JSON.stringify({ 
    error: 'UNAUTHORIZED',
    message: 'Invalid or expired token'
  }), {
    status: 401,
    headers: corsHeaders,
  });
}

console.log(`[${requestId}] Authenticated user: ${user.id}`);
```

**When to use:**
- Functions that require user authentication
- Functions accessing user-specific data
- Functions modifying user resources

**When to skip:**
- Public endpoints (webhooks, health checks)
- System-level cron jobs

---

### Step 3: Add Rate Limiting

**Purpose:** Prevent abuse and protect resources

```typescript
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const rateCheck = await checkRateLimit(supabase, user.id, {
  maxRequests: 10,          // Max requests
  windowMs: 15 * 60 * 1000, // Per 15 minutes
  keyPrefix: 'function-name', // Unique per function
});

if (!rateCheck.allowed) {
  console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`);
  return new Response(
    JSON.stringify({ 
      error: 'TOO_MANY_REQUESTS', 
      message: 'Too many requests. Please try again later.',
      retryAfter: rateCheck.retryAfter 
    }),
    { 
      status: 429, 
      headers: { 
        ...corsHeaders,
        'Retry-After': String(rateCheck.retryAfter || 60),
      } 
    }
  );
}
```

**Rate Limit Configuration:**
- **High-cost operations** (checkout, payouts): 10 requests / 15 min
- **Medium operations** (batch generation): 20 requests / 15 min
- **Read operations** (queries): 100 requests / 15 min

---

### Step 4: Add Input Validation

**Purpose:** Validate request body against schema

```typescript
import { YourRequestSchema } from '../_shared/contracts/yourFunction.ts';

const body = await req.json();
const validationResult = YourRequestSchema.safeParse(body);

if (!validationResult.success) {
  console.warn(`[${requestId}] Validation failed:`, validationResult.error.flatten());
  return new Response(JSON.stringify({
    error: 'VALIDATION_ERROR',
    message: 'Invalid request format',
    details: validationResult.error.flatten()
  }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const input = validationResult.data;
// input is now type-safe and validated!
```

**Schema Location:** `supabase/functions/_shared/contracts/`

**Example Schema:**
```typescript
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

export const YourRequestSchema = z.object({
  field1: z.string().min(1),
  field2: z.number().positive(),
  field3: z.boolean().default(false),
});

export type YourRequest = z.infer<typeof YourRequestSchema>;
```

---

### Step 5: Extract Business Logic to Service

**Purpose:** Separate domain logic from HTTP concerns

```typescript
// _shared/services/YourService.ts
export class YourServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'YourServiceError';
  }
}

export class YourService {
  constructor(
    private supabase: SupabaseClient,
    private config: EdgeFunctionConfig
  ) {}

  async processRequest(input: YourRequest): Promise<YourResponse> {
    // Pure business logic here
    // Throw YourServiceError for domain errors
  }
}
```

**In edge function:**
```typescript
const service = new YourService(supabase, config);

try {
  const result = await service.processRequest(input);
  return successResponse(result);
} catch (error) {
  if (error instanceof YourServiceError) {
    return new Response(JSON.stringify({
      error: error.code,
      message: error.message,
      details: error.details
    }), {
      status: 400,
      headers: corsHeaders
    });
  }
  throw error; // Re-throw for global error handler
}
```

---

### Step 6: Structured Error Handling

**Purpose:** Return appropriate error codes and messages

```typescript
try {
  // Middleware and business logic
} catch (error: unknown) {
  // Domain-specific errors (4xx)
  if (error instanceof CheckoutError) {
    console.error(`[${requestId}] ❌ ${error.code}: ${error.message}`);
    return new Response(JSON.stringify({
      error: error.code,
      message: error.message,
      details: error.details
    }), {
      status: 400,
      headers: corsHeaders
    });
  }
  
  // Unexpected errors (5xx)
  console.error(`[${requestId}] ❌ Unhandled error:`, error);
  return new Response(JSON.stringify({ 
    error: 'INTERNAL_ERROR',
    message: error.message 
  }), {
    status: 500,
    headers: corsHeaders
  });
}
```

**Error Codes:**
- `UNAUTHORIZED` (401) - Missing/invalid auth
- `FORBIDDEN` (403) - Insufficient permissions
- `VALIDATION_ERROR` (400) - Invalid input
- `TOO_MANY_REQUESTS` (429) - Rate limit exceeded
- `DOMAIN_SPECIFIC_ERROR` (400) - Business logic errors
- `INTERNAL_ERROR` (500) - Unexpected errors

---

### Step 7: Consistent Logging

**Purpose:** Standardized logs for debugging and monitoring

```typescript
// Format: [requestId] [FUNCTION_NAME] Status: Message

// Request start
console.log(`[${requestId}] [CHECKOUT] Request started: ${req.method} ${req.url}`);

// Progress
console.log(`[${requestId}] Authenticated user: ${user.id}`);
console.log(`[${requestId}] Processing cart ${cartId}`);

// Success (use ✅)
console.log(`[${requestId}] ✅ Success: order ${orderId} created`);

// Errors (use ❌)
console.error(`[${requestId}] ❌ Error [CODE]: message`);

// Warnings (use ⚠️)
console.warn(`[${requestId}] ⚠️ Rate limit exceeded for user ${userId}`);
```

---

## Middleware Layers

### Layer 1: Error Handling (Outermost)
- Catches all unhandled errors
- Returns 500 with error message
- Logs stack traces

### Layer 2: Request ID
- Generates UUID for request
- Adds to context
- Used in all logs

### Layer 3: CORS
- Validates origin
- Returns CORS headers
- Handles OPTIONS preflight

### Layer 4: Authentication
- Validates JWT token
- Extracts user
- Returns 401 if invalid

### Layer 5: Rate Limiting
- Checks request count
- Returns 429 if exceeded
- Configurable per function

### Layer 6: Validation
- Parses request body
- Validates against schema
- Returns 400 if invalid

### Layer 7: Business Logic (Innermost)
- Pure domain logic
- Uses validated input
- Returns success/domain errors

---

## Multi-Step Operations and Transaction Safety

### Understanding the Limitations

Supabase Edge Functions using the JavaScript client cannot use native database transactions for operations that span both Auth and database tables. This is because:

1. **Auth operations** (via `supabase.auth.admin.*`) are API calls to a separate Auth service, not database operations
2. **Cross-service atomicity** is not supported - you cannot wrap Auth API calls and database queries in a single transaction
3. **Manual compensation** is required when multi-step operations fail partway through

### Known Edge Cases and Failure Scenarios

When implementing multi-step operations (like user creation + role assignment + status updates), be aware of these failure scenarios:

**Scenario 1: Partial User Creation**
```typescript
// Step 1 succeeds
const { data: authData } = await supabase.auth.admin.createUser({...});

// Step 2 fails - user exists but role was not assigned
const { error: roleError } = await supabase.from("user_roles").insert({...});
// ⚠️ User account exists without proper role - orphaned record
```

**Scenario 2: Missing Cleanup**
```typescript
// Step 1 & 2 succeed
const authData = await createUser();
await assignRole(authData.user.id);

// Step 3 fails but only logs - token remains reusable
const { error } = await markInvitationUsed(token);
if (error) {
  console.error("Failed to mark invitation", error);
  // ⚠️ User created, token not marked used - invitation can be reused
}
```

**Scenario 3: Race Conditions**
```typescript
// Two concurrent requests with same invitation token
// Both might pass the "is invitation used?" check simultaneously
const invitation = await supabase
  .from("admin_invitations")
  .select("*")
  .eq("invitation_token", token)
  .is("used_at", null)
  .single();
// ⚠️ Both proceed to create users - duplicate accounts possible
```

### Recommended Patterns

#### Pattern 1: Compensating Transactions (Current Best Practice)

Implement manual rollback for critical operations:

```typescript
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: invitation.email,
  password,
  email_confirm: true,
});

if (authError) {
  return errorResponse("Failed to create user");
}

const { error: roleError } = await supabase
  .from("user_roles")
  .insert({ user_id: authData.user.id, role: "admin" });

if (roleError) {
  // Compensating transaction: delete the user we just created
  console.error(`[${requestId}] Role assignment failed, deleting user`);
  await supabase.auth.admin.deleteUser(authData.user.id);
  return errorResponse("Failed to assign admin role");
}

// For non-critical operations, log failures instead of rolling back
const { error: markUsedError } = await supabase
  .from("admin_invitations")
  .update({ used_at: new Date().toISOString() })
  .eq("invitation_token", token);

if (markUsedError) {
  // Don't rollback user creation for this - just log for manual cleanup
  console.error(`[${requestId}] Failed to mark invitation as used`, {
    error: markUsedError,
    userId: authData.user.id,
    token: token.substring(0, 8) + "...",
  });
}
```

**Limitations of this pattern:**
- Not truly atomic - network failures between delete calls can leave partial state
- Auth deletions might fail, leaving orphaned auth records
- Cleanup operations themselves can fail

#### Pattern 2: Optimistic Locking for Race Conditions

Use database constraints and conditional updates:

```typescript
// Prevent race conditions with a CHECK constraint on the token
// Database level: ALTER TABLE admin_invitations ADD CONSTRAINT 
// unique_unused_token UNIQUE (invitation_token) WHERE used_at IS NULL;

const { error: markUsedError } = await supabase
  .from("admin_invitations")
  .update({ used_at: new Date().toISOString() })
  .eq("invitation_token", token)
  .is("used_at", null)  // Only update if still null
  .select()
  .single();

if (markUsedError || !updateResult) {
  // Token was already marked used by another request
  return errorResponse("Invitation already used");
}

// Now proceed with user creation...
```

**Note:** This pattern requires moving the "mark used" operation BEFORE user creation to prevent duplicates.

#### Pattern 3: Idempotency Keys

For operations that might be retried, use idempotency to prevent duplicates:

```typescript
// Store operation state with a unique key
const operationId = crypto.randomUUID();

const { error } = await supabase
  .from("operation_log")
  .insert({
    operation_id: operationId,
    type: "user_creation",
    token: token,
    status: "pending",
  });

if (error?.code === "23505") {
  // Duplicate operation - already processed
  return errorResponse("Operation already in progress");
}

try {
  // Perform multi-step operation
  const user = await createUser();
  await assignRole(user.id);
  
  // Mark complete
  await supabase
    .from("operation_log")
    .update({ status: "completed", user_id: user.id })
    .eq("operation_id", operationId);
    
} catch (error) {
  // Mark failed for manual intervention
  await supabase
    .from("operation_log")
    .update({ status: "failed", error: error.message })
    .eq("operation_id", operationId);
  throw error;
}
```

### Monitoring and Alerting

**Critical Alerts:**
1. **Orphaned auth users** - Query for auth users without corresponding role records daily
2. **Unused invitations with users** - Find invitations with `used_at = null` but email matches existing user
3. **Failed operation logs** - Alert on operations stuck in "pending" or "failed" status

**Monitoring Queries:**
```sql
-- Find users without roles (run daily)
SELECT auth.users.id, auth.users.email, auth.users.created_at
FROM auth.users
LEFT JOIN user_roles ON auth.users.id = user_roles.user_id
WHERE user_roles.user_id IS NULL
AND auth.users.created_at > NOW() - INTERVAL '7 days';

-- Find invitations that weren't marked used
SELECT ai.email, ai.created_at, ai.invitation_token
FROM admin_invitations ai
JOIN auth.users u ON u.email = ai.email
WHERE ai.used_at IS NULL
AND u.created_at > ai.created_at;
```

### Documentation Requirements

For each multi-step operation in your edge function, document:

1. **Operation order** - List the steps in sequence
2. **Failure points** - Where can each step fail?
3. **Compensation strategy** - What cleanup happens on failure?
4. **Non-fatal failures** - Which failures are logged but don't rollback?
5. **Race condition risk** - Can concurrent requests cause issues?

**Example Documentation (in code comments):**
```typescript
/**
 * Multi-step user creation flow
 * 
 * Steps:
 * 1. Validate invitation token (DB query)
 * 2. Create auth user (Auth API - CRITICAL)
 * 3. Assign role (DB insert - CRITICAL)
 * 4. Mark invitation used (DB update - NON-CRITICAL)
 * 5. Log admin action (RPC call - NON-CRITICAL)
 * 
 * Compensation:
 * - If step 3 fails: Delete auth user from step 2
 * - If step 4 fails: Log error, continue (manual cleanup needed)
 * - If step 5 fails: Log error, continue
 * 
 * Known edge cases:
 * - Network failure between steps 3-4: User created, token reusable
 * - Auth delete fails in compensation: Orphaned auth user
 * - Concurrent requests: Possible duplicate users (mitigate with DB constraints)
 * 
 * Monitoring:
 * - Daily check for orphaned users (see monitoring queries)
 * - Alert on invitation marking failures
 */
```

### Future Improvements

For production systems requiring stronger guarantees, consider:

1. **Saga orchestration** - Implement a saga coordinator that manages multi-step workflows with compensating transactions
2. **Event sourcing** - Store state changes as events, enabling replay and recovery
3. **Database functions** - Move multi-step operations to PostgreSQL functions where possible (limited for Auth operations)
4. **Two-phase commit** - For operations that can be coordinated within the database
5. **Background reconciliation** - Periodic jobs that detect and fix orphaned records

---

## Common Patterns

### Pattern 1: Authenticated User-Facing Endpoint
```typescript
// Auth + Rate Limit + Validation
serve(async (req) => {
  const requestId = crypto.randomUUID();
  try {
    const config = loadConfig();
    const supabase = createClient(/* service role */);
    
    const { user } = await authenticate(req, supabase);
    await rateLimit(supabase, user.id, { max: 10, window: 15min });
    const input = validate(body, schema);
    
    const result = await service.process(input);
    return success(result);
  } catch (error) {
    return handleError(error, requestId);
  }
});
```

### Pattern 2: Public Webhook
```typescript
// No auth, just validation and rate limiting by IP
serve(async (req) => {
  const requestId = crypto.randomUUID();
  try {
    const ip = req.headers.get('x-forwarded-for');
    await rateLimit(supabase, ip, { max: 100, window: 1min });
    
    const input = validate(body, schema);
    const result = await service.process(input);
    return success(result);
  } catch (error) {
    return handleError(error, requestId);
  }
});
```

### Pattern 3: Admin-Only Endpoint
```typescript
// Auth + Admin check
serve(async (req) => {
  const requestId = crypto.randomUUID();
  try {
    const { user } = await authenticate(req, supabase);
    
    // Check admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
      
    if (!roles?.some(r => r.role === 'admin')) {
      return forbidden('Admin access required');
    }
    
    const result = await service.adminAction(input);
    return success(result);
  } catch (error) {
    return handleError(error, requestId);
  }
});
```

---

## Testing

### Unit Test Middleware
```typescript
// Test auth middleware
Deno.test('withAuth - returns 401 for missing header', async () => {
  const req = new Request('https://example.com', { method: 'POST' });
  const response = await withAuth(mockHandler)(req, {});
  assertEquals(response.status, 401);
});
```

### Test Business Logic Without Middleware
```typescript
// Mock authenticated context
Deno.test('CheckoutService - processes valid request', async () => {
  const service = new CheckoutService(mockSupabase, mockStripe);
  const result = await service.processCheckout(validInput);
  assertEquals(result.success, true);
});
```

### Integration Test Full Stack
```typescript
// Test full edge function
Deno.test('checkout - complete flow', async () => {
  const req = new Request('https://example.com/checkout', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer valid-token' },
    body: JSON.stringify(validRequest)
  });
  
  const response = await handler(req);
  assertEquals(response.status, 200);
});
```

---

## Next Steps

1. ✅ Review `checkout/index.ts` as reference implementation
2. ✅ Compare with `generate-batches/index.ts` (before refactoring)
3. ✅ Pick one simple function to refactor first
4. ✅ Test thoroughly before and after
5. ✅ Gradually migrate other functions
6. ✅ Document new patterns you discover

---

## Questions?

See `_shared/middleware/` for middleware implementations.
See `_shared/services/` for service layer patterns.
See `_shared/contracts/` for validation schemas.
