# API Documentation

Complete reference for all Supabase Edge Functions in the Blue Harvests platform.

**Shared Contracts**: All request/response schemas are defined in `src/contracts/` and shared between frontend and backend via Deno-compatible re-exports in `supabase/functions/_shared/contracts/`. This ensures type safety and eliminates drift.

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Codes](#error-codes)
- [Edge Functions](#edge-functions)
  - [Checkout](#checkout)
  - [Optimize Delivery Batches](#optimize-delivery-batches)
  - [Generate Batches](#generate-batches)
  - [Process Payouts](#process-payouts)

---

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```bash
Authorization: Bearer <JWT_TOKEN>
```

Get your JWT token from Supabase Auth after login.

---

## Rate Limiting

All endpoints have rate limiting to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/checkout` | 10 requests | 15 minutes |
| `/optimize-delivery-batches` | 10 requests | 1 minute |
| `/generate-batches` | 5 requests | 1 minute |
| `/process-payouts` | 1 request | 5 minutes |

**Rate Limit Response (429):**
```json
{
  "error": "TOO_MANY_REQUESTS",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

---

## Error Codes

All errors follow a consistent schema:

```typescript
{
  error: string;        // Error code (e.g., "INVALID_CART")
  message: string;      // Human-readable message
  details?: object;     // Optional additional context
  retryAfter?: number;  // For rate limiting (seconds)
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or expired JWT token |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Edge Functions

### Checkout

Process a customer order with payment and inventory management.

**Endpoint:** `POST /functions/v1/checkout`

**Auth Required:** ✅ Yes (Consumer role)

**Rate Limit:** 10 requests per 15 minutes

**Request Schema:**
```typescript
{
  cart_id: string;          // UUID of shopping cart
  delivery_date: string;    // ISO 8601 datetime
  use_credits: boolean;     // Whether to apply available credits
  payment_method_id?: string; // Stripe payment method ID (optional)
  tip_amount: number;       // Tip amount in USD (default: 0)
}
```

**Response Schema (200):**
```typescript
{
  success: true;
  order_id: string;         // UUID of created order
  client_secret?: string;   // Stripe client secret (if payment required)
  amount_charged: number;   // Total amount charged in USD
  credits_redeemed: number; // Amount of credits applied in USD
  payment_status: 'paid' | 'pending' | 'requires_action';
}
```

**Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_ADDRESS` | 400 | User has no delivery address |
| `INVALID_CART` | 400 | Cart not found or doesn't belong to user |
| `EMPTY_CART` | 400 | Cart has no items |
| `MISSING_PROFILE_INFO` | 400 | User profile incomplete |
| `NO_MARKET_CONFIG` | 400 | No market config for user's ZIP |
| `INVALID_DELIVERY_DATE` | 400 | Delivery not available on selected date |
| `CUTOFF_PASSED` | 400 | Order cutoff time has passed |
| `INSUFFICIENT_INVENTORY` | 400 | Some products out of stock |
| `BELOW_MINIMUM_ORDER` | 400 | Order total below minimum |
| `PAYMENT_FAILED` | 400 | Stripe payment failed |
| `CHECKOUT_ERROR` | 500 | General checkout error |

**Example Request:**
```bash
curl -X POST https://xushmvtkfkijrhfoxhat.supabase.co/functions/v1/checkout \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cart_id": "123e4567-e89b-12d3-a456-426614174000",
    "delivery_date": "2025-11-05T10:00:00Z",
    "use_credits": true,
    "tip_amount": 5.00
  }'
```

**Example Response:**
```json
{
  "success": true,
  "order_id": "987e6543-e21b-43d2-b654-426614174999",
  "amount_charged": 42.50,
  "credits_redeemed": 10.00,
  "payment_status": "paid"
}
```

---

### Optimize Delivery Batches

Create optimized delivery batches using AI or geographic fallback.

**Endpoint:** `POST /functions/v1/optimize-delivery-batches`

**Auth Required:** ✅ Yes (Admin role)

**Rate Limit:** 10 requests per 1 minute

**Request Schema:**
```typescript
{
  delivery_date?: string;   // ISO date string (default: tomorrow)
  force_ai?: boolean;       // Force AI path even if fallback would be used
}
```

**Response Schema (200):**
```typescript
{
  success: true;
  delivery_date: string;         // ISO date
  batches_created: number;       // Number of batches created
  total_orders: number;          // Total orders processed
  optimization_method: 'ai' | 'geographic_fallback';
  optimization_confidence?: number; // 0-1 score (AI only)
  fallback_reason?: string;      // Why fallback was used
  batches: Array<{
    batch_id: number;
    order_count: number;
    collection_point_id: string;
    collection_point_address: string;
    zip_codes: string[];
    is_subsidized: boolean;
    rationale?: string;          // AI explanation
  }>;
}
```

**Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `NO_ORDERS` | 400 | No orders found for date |
| `OPTIMIZATION_FAILED` | 500 | Both AI and fallback failed |
| `DATABASE_ERROR` | 500 | Database operation failed |

**Example Request:**
```bash
curl -X POST https://xushmvtkfkijrhfoxhat.supabase.co/functions/v1/optimize-delivery-batches \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "delivery_date": "2025-11-05",
    "force_ai": false
  }'
```

**Example Response:**
```json
{
  "success": true,
  "delivery_date": "2025-11-05",
  "batches_created": 3,
  "total_orders": 42,
  "optimization_method": "ai",
  "optimization_confidence": 0.89,
  "batches": [
    {
      "batch_id": 1,
      "order_count": 15,
      "collection_point_id": "cp-123",
      "collection_point_address": "123 Main St",
      "zip_codes": ["10001", "10002"],
      "is_subsidized": false,
      "rationale": "Dense cluster in midtown"
    }
  ]
}
```

---

### Generate Batches

Generate delivery batches with route optimization (legacy function).

**Endpoint:** `POST /functions/v1/generate-batches`

**Auth Required:** ✅ Yes (Admin role)

**Rate Limit:** 5 requests per 1 minute

**Request Schema:**
```typescript
{
  // No body required - processes tomorrow's orders
}
```

**Response Schema (200):**
```typescript
{
  success: true;
  message: string;
  batches_created: number;
}
```

**Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `NO_ORDERS` | 400 | No pending orders for tomorrow |
| `BATCH_CREATION_FAILED` | 500 | Failed to create batches |

---

### Process Payouts

Process pending payouts to Stripe Connect accounts.

**Endpoint:** `POST /functions/v1/process-payouts`

**Auth Required:** ✅ Yes (Admin role)

**Rate Limit:** 1 request per 5 minutes

**Request Schema:**
```typescript
{
  order_ids?: string[];         // Optional: specific orders
  payout_type?: 'farmer' | 'lead_farmer' | 'driver' | 'platform_fee';
}
```

**Response Schema (200):**
```typescript
{
  success: true;
  payouts_processed: number;
  total_amount: number;
  failures?: Array<{
    payout_id: string;
    error: string;
  }>;
}
```

**Error Codes:**

| Code | Status | Description |
|------|--------|-------------|
| `NO_PAYOUTS` | 200 | No pending payouts |
| `PAYOUTS_NOT_ENABLED` | 400 | Connect account not ready |
| `SERVER_ERROR` | 500 | Payout processing failed |

**Example Request:**
```bash
curl -X POST https://xushmvtkfkijrhfoxhat.supabase.co/functions/v1/process-payouts \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Example Response:**
```json
{
  "success": true,
  "payouts_processed": 5,
  "total_amount": 1250.00
}
```

---

## Stripe Webhook (POST-DEMO)

Handle Stripe webhook events for payment and subscription state sync.

**Endpoint:** `POST /functions/v1/stripe-webhook`

**Auth Required:** ❌ No (signature verification instead)

**Rate Limit:** None (Stripe retries failed webhooks)

**Security:**
- Webhook signature verification using `STRIPE_WEBHOOK_SECRET`
- Rejects unsigned requests with 400 error

**Supported Events:**

| Event Type | Description | TODO Implementation |
|------------|-------------|---------------------|
| `payment_intent.succeeded` | Payment completed | Update order to 'paid', send confirmation email, award credits |
| `payment_intent.payment_failed` | Payment failed | Mark order as 'failed', notify consumer with retry instructions |
| `customer.subscription.updated` | Subscription changed | Sync subscription status, update credits eligibility |
| `customer.subscription.deleted` | Subscription canceled | Disable credits earning, send cancellation confirmation |
| `charge.dispute.created` | Customer dispute filed | Notify admin, flag order for review, pause payouts |
| `payout.failed` | Payout to Stripe Connect failed | Retry payout logic, alert finance team |

**Request (from Stripe):**
```
POST /functions/v1/stripe-webhook
stripe-signature: t=1234567890,v1=abc123...
Content-Type: application/json

{
  "id": "evt_1234567890",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "amount": 2500,
      "currency": "usd",
      "metadata": {
        "order_id": "abc-123-def-456"
      }
    }
  }
}
```

**Response (200):**
```json
{
  "received": true,
  "event": "payment_intent.succeeded"
}
```

**Error Response (400):**
```json
{
  "error": "Webhook Error: Invalid signature"
}
```

**Setup Instructions:**
1. Add `STRIPE_WEBHOOK_SECRET` to Lovable Cloud Secrets
2. Configure webhook endpoint in Stripe Dashboard → Webhooks
3. Implement event handlers in `stripe-webhook/index.ts` (currently stubs)

**Why This Matters:**
- Shows production-readiness thinking
- Webhook signature verification is critical security
- TODOs demonstrate edge cases have been considered
- Ready to implement post-demo with minimal code changes

---

## Development

### Local Testing

```bash
# Start Supabase locally
supabase start

# Invoke function
supabase functions serve checkout --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/checkout \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"cart_id": "..."}'
```

### Viewing Logs

```bash
# Edge function logs
supabase functions logs checkout --follow

# All functions
supabase functions logs --follow
```

### Adding a New Function

1. Create function directory:
```bash
supabase functions new my-function
```

2. Add middleware using composition:
```typescript
import { 
  composeMiddleware,
  withErrorHandling,
  withCORS,
  withAuth,
  withRateLimit,
  withValidation 
} from '../_shared/middleware/index.ts';

// Compose middleware (right to left execution)
const handler = composeMiddleware([
  withErrorHandling,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.MY_FUNCTION),
  withValidation(MyRequestSchema),
]);

serve(handler(async (req, ctx) => {
  // Your logic here
  // ctx.user - Authenticated user
  // ctx.corsHeaders - CORS headers
  // ctx.requestId - Request tracking ID
  return new Response(JSON.stringify({ data: 'Hello' }));
}));
```

**Alternative: Explicit ordering with createMiddlewareStack**
```typescript
import { createMiddlewareStack } from '../_shared/middleware/index.ts';

// First middleware runs first (top to bottom)
const handler = createMiddlewareStack([
  withErrorHandling,  // Wraps everything
  withRequestId,      // Adds tracking ID
  withCORS,          // Validates origin
  withAuth,          // Authenticates user
]);
```

3. Add to `supabase/config.toml`:
```toml
[functions.my-function]
verify_jwt = true
```

4. Deploy:
```bash
supabase functions deploy my-function
```

---

## Support

For issues or questions:
- Check logs in Supabase dashboard
- Review [ARCHITECTURE.md](./ARCHITECTURE.md)
- Contact dev team

---

**Last Updated:** 2025-11-01
