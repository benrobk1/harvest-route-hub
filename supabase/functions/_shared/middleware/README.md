<small>Last updated: 2024-05-09</small>

# Middleware Platform Reference

> Enterprise-grade documentation for the Harvest Route Hub edge middleware platform. Treat this
> file as the authoritative operating manual for the stack that powers every serverless function.

## Table of contents

1. [Platform overview](#platform-overview)
2. [Execution model](#execution-model)
3. [Request lifecycle](#request-lifecycle)
4. [Middleware catalog](#middleware-catalog)
5. [Implementation playbooks](#implementation-playbooks)
6. [Operational excellence](#operational-excellence)
7. [Quality gates](#quality-gates)
8. [Change management](#change-management)
9. [Appendix](#appendix)

## Platform overview

- **Objective** – Deliver a uniform, auditable, and recoverable runtime for all Supabase Edge
  Functions. Middleware centralizes authentication, authorization, configuration, and
  observability so teams can ship features without reimplementing primitives.
- **Scope** – Every file under `supabase/functions/*/index.ts` composes a middleware stack using
  `createMiddlewareStack`. The regression suite blocks merges that bypass this contract.
- **Guarantees** – Consistent response envelopes, structured logging with request IDs, shared
  Supabase clients, and centralized error handling.

## Execution model

1. **Stack construction** – An entrypoint imports middleware from `_shared/middleware` and calls
   `createMiddlewareStack` with middleware ordered by desired execution sequence.
2. **Bootstrap** – Middleware initializes shared context (configuration, request IDs, Supabase
   clients, sessions) before the handler runs.
3. **Business logic** – The handler receives `(request, context)` where `context` aggregates every
   property supplied by the middleware chain.
4. **Response normalization** – Error handling, CORS, and rate limiting middleware harmonize the
   outgoing response. The result is serializable JSON with deterministic headers.

`createMiddlewareStack` enforces **left-to-right execution**. The first middleware in the array
executes first, and each successive middleware receives the context produced by upstream layers.
Internally the factory reverses the array before composition so the public API remains intuitive
(top-to-bottom ordering) while still leveraging the `composeMiddleware` reduce-right
implementation. The result: the array you pass in is the array you reason about, with no mental
gymnastics about reversed execution order.

## Request lifecycle

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Incoming HTTP Request                                                      │
└───────────────┬────────────────────────────────────────────────────────────┘
                │
                ▼
      withRequestId → withCORS → withRateLimit? → withAuth? → withValidation?
                │             │             │             │
                ▼             ▼             ▼             ▼
      Request logging   Origin negotiation  Token checks   Payload parsing
                │
                ▼
      withSupabaseServiceRole → Business Handler → withErrorHandling
                │                                 │
                ▼                                 ▼
        Supabase + config                 Structured success/error
                │
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Normalized Response (JSON body + enterprise headers)                       │
└────────────────────────────────────────────────────────────────────────────┘
```

## Middleware catalog

The following catalog is ordered by the recommended default sequence. Each entry documents
purpose, dependencies, context, failure behaviors, and observability notes.

### `withRequestId`

- **Purpose** – Generates a UUID per request, injects it into context, and wraps the downstream
  handler with start/stop logging including duration metrics.
- **Context** – `{ requestId: string }`
- **Failure modes** – None; falls back to a synthetic ID if UUID creation fails.
- **Observability** – Logs include `[<requestId>] [<FUNCTION>]` prefix to streamline tracing.

### `withCORS`

- **Purpose** – Validates the `Origin` header against the configured allow list and stamps
  responses with consistent CORS headers.
- **Context** – `{ corsHeaders: Record<string, string> }`
- **Dependencies** – Relies on configuration loaded by `withSupabaseServiceRole` when run later
  in the chain. If executed earlier, it reads the environment allow list directly.
- **Failure modes** – Rejects disallowed origins with a 403 JSON response and still attaches CORS
  headers for clients to inspect.

### `withRateLimit`

- **Purpose** – Enforces configurable request quotas using the Redis-backed store in
  `_shared/redis.ts`.
- **Context** – `{ rateLimit: { limit: number; remaining: number; resetIn: number } }`
- **Dependencies** – Requires a `RateLimitStore` implementation; the helper factory accepts it as
  configuration.
- **Failure modes** – Returns 429 with problem-details payload when the quota is exhausted.
- **Observability** – Emits structured logs and attaches the remaining quota to the response
  headers for dashboards.

### `withValidation`

- **Purpose** – Parses JSON bodies and validates against a supplied Zod schema.
- **Context** – `{ input: T }` where `T` is the schema output.
- **Failure modes** – Returns 422 with validation errors; logs include the request ID and the
  schema path that failed.
- **Security** – Rejects payloads over the configured size limit before parsing.

### `withAuth`

- **Purpose** – Verifies Supabase JWTs and attaches the authenticated user to context.
- **Context** – `{ user: User }`
- **Failure modes** – 401 JSON response when the token is missing or invalid.
- **Usage notes** – Compose before role-sensitive middleware (for example `withAdminAuth`).

### `withAdminAuth`

- **Purpose** – Ensures the authenticated user belongs to the admin role set.
- **Context** – Reuses `{ user: User }` from `withAuth`.
- **Failure modes** – 403 JSON response with reason code when role membership fails.
- **Security** – Emits structured audit logs capturing user ID, route name, and rejection reason.

### `withSupabaseServiceRole`

- **Purpose** – Loads configuration, constructs a Supabase client using the service role key, and
  memoizes it for the request lifecycle.
- **Context** – `{ supabase: SupabaseClient; config: Config }`
- **Failure modes** – 500 response when environment configuration is incomplete.
- **Observability** – Logs config loading durations and flags missing keys early in the request
  lifecycle.

### `withErrorHandling`

- **Purpose** – Provides a final safety net that converts thrown errors into JSON responses with
  standardized structure (`{ error: { code, message, request_id } }`).
- **Context** – None added; relies on upstream `requestId` for logging.
- **Failure modes** – If the handler returns a malformed response, it wraps the error in a 500
  payload and logs the original stack trace.

## Implementation playbooks

### Authoring new edge handlers

1. Import the stack factory and required middleware:

   ```ts
   import {
     createMiddlewareStack,
     withRequestId,
     withCORS,
     withSupabaseServiceRole,
     withErrorHandling,
   } from '../_shared/middleware/index.ts';
   ```

2. Compose middleware in the recommended order and wrap your handler:

   ```ts
   const stack = createMiddlewareStack([
     withErrorHandling,
     withRequestId,
     withCORS,
     withSupabaseServiceRole,
   ]);

   export const handler = stack(async (request, context) => {
     // business logic using context.supabase, context.config, etc.
   });
   ```

3. Start the function with Supabase's `serve` helper:

   ```ts
   serve((request) => handler(request, {}));
   ```

4. Add the regression test (`bun test supabase/functions/_shared/__tests__/middlewareMigration.test.ts`) to your
   CI checks when introducing new handlers. The suite enforces stack adoption automatically.

### Handler context typing

- Each middleware exports a context interface (for example `RequestIdContext`). Extend these in a
  local interface so TypeScript infers the combined shape.
- When adding new middleware, export its context type and ensure consuming handlers update their
  local context interface accordingly.

### Authoring new middleware

- **Signature** – Middleware is a higher-order function that accepts configuration and returns a
  handler in the shape `(next) => async (request, context) => Response`.
- **Context merging** – Always spread the existing context when adding new properties:
  `await next(request, { ...context, newProp })`.
- **Error safety** – Throw typed errors or return structured responses; downstream
  `withErrorHandling` will convert them into JSON.
- **Configuration loading** – Reuse shared helpers (for example `loadConfig`) rather than reading
  environment variables directly.
- **Testing** – Co-locate unit tests next to the middleware module to validate edge cases and
  exported context types.

## Operational excellence

### Observability

- Logs must include the `requestId` so distributed traces can correlate related events.
- Structured logging prefixes include the function name in uppercase for quicker filtering.
- `withSupabaseServiceRole` centralizes Supabase client creation, enabling future connection
  pooling and instrumentation hooks.
- Rate limiting relies on the shared Redis-backed store configured in `_shared/redis.ts` and
  publishes remaining quota to response headers.

### Security

- JWT validation is mandatory for every route that processes user-specific data. Pair `withAuth`
  with `withAdminAuth` or custom role middleware when elevated permissions are required.
- Configuration secrets (Stripe keys, Supabase service role) are only read inside
  `withSupabaseServiceRole` to limit surface area.
- Validation middleware should whitelist allowed schema fields to protect against injection and
  overflow attacks.

### Reliability

- `withErrorHandling` guarantees deterministic JSON responses even when downstream handlers throw
  raw exceptions.
- Rate limiting protects upstream dependencies from abuse. Tune quotas based on production SLOs.
- Consider chaining custom middleware (for example circuit breakers) ahead of `withErrorHandling`
  for high-risk integrations.

## Quality gates

- **Regression enforcement** – `supabase/functions/_shared/__tests__/middlewareMigration.test.ts`
  scans every edge function to ensure the stack and Supabase middleware are composed.
- **Unit tests** – Middleware modules should expose unit tests capturing success, failure, and
  logging paths. Use Bun's test runner for fast execution.
- **Static analysis** – eslint and TypeScript enforce consistent imports and context typing.

## Change management

- Update this document when introducing new middleware or altering execution order.
- When deprecating middleware, update both the regression suite and handler compositions.
- Document observable behavior changes (HTTP status codes, headers, context keys) for downstream
  services and clients.
- Announce breaking changes in `#middleware-runtime` Slack channel and coordinate deployment with
  the platform team.

## Appendix

- **Reference implementation** – `supabase/functions/check-subscription/index.ts` illustrates the
  full stack: request IDs, CORS, Supabase access, auth, and error handling in action.
- **Troubleshooting checklist**
  1. Confirm the regression suite passes.
  2. Tail function logs filtered by `requestId`.
  3. Verify Supabase service-role key availability.
  4. Re-run validation with representative payloads.
- **Further reading** – See `ARCHITECTURE.md` for system-level context and
  `DATABASE.md` for schema relationships leveraged by the middleware-enabled functions.
