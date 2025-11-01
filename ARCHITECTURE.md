# Blue Harvests Architecture Guide

## 🏗️ System Architecture

Blue Harvests is a full-stack local food delivery marketplace built on React, TypeScript, and Supabase (via Lovable Cloud). The architecture follows a clean separation between frontend UI, backend services, and external integrations.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │    Pages     │  │  Components  │  │  React Query Hooks   │ │
│  │  (Routes)    │──│     (UI)     │──│   (API Wrappers)     │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│         │                  │                     │              │
│         └──────────────────┴─────────────────────┘              │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │ Zod Contracts   │ ◄─── Shared Validation   │
│                   │  (src/contracts)│                          │
│                   └────────┬────────┘                          │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    HTTPS/WebSocket
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                    BACKEND (Edge Functions)                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            Composable Middleware Pipeline                │ │
│  │  withAuth → withRateLimit → withValidation → Handler    │ │
│  └──────────────────────────────────────────────────────────┘ │
│         │                  │                     │              │
│  ┌──────▼──────┐  ┌────────▼────────┐  ┌────────▼──────────┐ │
│  │   Checkout  │  │  Batch          │  │   Payout          │ │
│  │   Service   │  │  Optimization   │  │   Processing      │ │
│  └─────────────┘  └─────────────────┘  └───────────────────┘ │
│         │                  │                     │              │
└─────────┼──────────────────┼─────────────────────┼─────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │   Stripe   │  │   Mapbox   │  │    Lovable AI        │  │
│  │  Payments  │  │  Geocoding │  │  (Batch Optimization)│  │
│  └────────────┘  └────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 📦 Module Organization

### Frontend (`src/`)

#### `/pages` - Route Components
- **Consumer**: Shop, Checkout, Order Tracking, Profile
- **Farmer**: Dashboard, Inventory Management, Financials, Analytics
- **Driver**: Available Routes, Route Details, Payout Details
- **Admin**: Dashboard, User Approvals, Product Approval, Analytics

#### `/components` - Reusable UI Components
- **UI Components** (`/ui`): shadcn components (Button, Card, Dialog, etc.)
- **Feature Components**: Cart, Order Tracking, Product Cards, etc.
- **Role-Specific** (`/farmer`, `/driver`, `/consumer`, `/admin`): Role-based features

#### `/contracts` - **Zod Schemas (NEW)**
- Shared validation between frontend and backend
- Single source of truth for request/response shapes
- Runtime validation + compile-time types
- Files: `checkout.ts`, `batching.ts`, `payouts.ts`, `subscription.ts`

#### `/config` - **Configuration & Constants (NEW)**
- `env.ts`: Client-side environment validation (fail-fast on missing vars)
- `constants.ts`: Business rules (revenue splits, fees, limits)

#### `/hooks` - Custom React Hooks
- API wrappers using React Query
- Cart management, authentication, subscriptions

#### `/lib` - Pure Utility Functions
- Money formatting, distance calculations, date helpers
- No side effects, easily testable

#### `/integrations/supabase` - **Auto-Generated (DO NOT EDIT)**
- `client.ts`: Supabase client instance
- `types.ts`: Database types from schema

### Backend (`supabase/functions/`)

#### `/_shared` - **Shared Modules (NEW)**
- **`/middleware`**: Composable request handlers
  - `withAuth.ts`: JWT validation
  - `withValidation.ts`: Request schema validation
  - `withRateLimit.ts`: Rate limiting per user
  - `withErrorHandling.ts`: Structured error responses
- **`/services`**: Business logic extraction (see refactoring plan)
- **`config.ts`**: Environment loading with fail-fast validation
- **`constants.ts`**: Server-side business rules
- `rateLimiter.ts`: Rate limit implementation

#### `/[function-name]` - Edge Function Handlers
- **Thin handlers**: Compose middleware, call services
- **Pattern**: `withAuth(withRateLimit(withValidation(schema, handler)))`
- Functions: `checkout`, `optimize-delivery-batches`, `process-payouts`, etc.

## 🔒 Security Model

### Authentication & Authorization
- **JWT Validation**: All protected endpoints use `withAuth` middleware
- **Role-Based Access**: Separate tables for user roles (admin, farmer, driver, consumer)
- **Row-Level Security (RLS)**: Database policies enforce user permissions

### Input Validation
- **Client-Side**: Zod schemas validate forms before submission
- **Server-Side**: Same Zod schemas validate edge function requests
- **SQL Injection Prevention**: Parameterized queries via Supabase client

### Rate Limiting
- **Per-User Limits**: Prevents abuse and API spam
- **Configurable**: Different limits per endpoint (checkout, batch gen, etc.)
- **Graceful**: Returns `429` with `Retry-After` header

### Secrets Management
- **Environment Variables**: Managed via Lovable Cloud Secrets UI
- **Never Logged**: Sensitive data filtered from logs
- **Fail-Fast**: Missing critical secrets cause immediate error

## 💰 Revenue Model

| Component          | Percentage | Recipient       | Notes                        |
|--------------------|------------|-----------------|------------------------------|
| Product Revenue    | 88%        | Farmer          | Base farmer earnings         |
| Product Revenue    | 2%         | Lead Farmer     | Collection point management  |
| Product Revenue    | 10%        | Platform Fee    | Operating costs              |
| Delivery Fee       | $7.50      | Driver          | Flat fee per order           |
| Tip (optional)     | 100%       | Driver          | Consumer tips go to driver   |

**Validation**: Revenue splits are validated at startup to ensure they sum to 100%.

## 🚀 Critical User Flows

### 1. Consumer Checkout Flow

```
1. Consumer adds products to cart (localStorage + database sync)
2. Consumer navigates to checkout page
3. Frontend validates cart items and calculates totals
4. Consumer enters payment method (Stripe.js)
5. Frontend calls /checkout edge function
   │
   ├─► Auth middleware validates JWT
   ├─► Rate limit middleware checks request count
   ├─► Validation middleware validates request schema
   └─► Checkout service:
       ├─► Geocode delivery address (Mapbox, optional)
       ├─► Validate cart items & inventory
       ├─► Apply credits (if requested)
       ├─► Create Stripe payment intent
       ├─► Create order + order items in database
       ├─► Decrement inventory
       ├─► Create payout records (farmer, lead farmer, platform, driver)
       ├─► Clear cart
       └─► Return order confirmation
6. Frontend displays confirmation + order tracking link
```

### 2. Batch Generation Flow (Dual-Path Optimization)

```
1. Admin/CRON triggers batch generation for delivery date
2. Edge function fetches pending orders for target date
3. Groups orders by collection point → ZIP code
4. Optimization Strategy:
   
   ┌─────────────────────────────────────────────┐
   │  PRIMARY: AI-Powered Optimization           │
   │  (if LOVABLE_API_KEY configured)            │
   ├─────────────────────────────────────────────┤
   │  • Uses Gemini 2.5 Flash                    │
   │  • Multi-constraint optimization:           │
   │    - Geographic proximity                   │
   │    - Batch size targets (min/max)           │
   │    - Route time limits                      │
   │    - Driver capacity                        │
   │  • Handles edge cases (late additions, etc.)│
   │  • Returns rationale for each batch         │
   └─────────────────────────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │  Fallback on Failure:  │
        │  429 (rate limit)      │
        │  402 (credits)         │
        │  API timeout           │
        └───────────┬────────────┘
                    ▼
   ┌─────────────────────────────────────────────┐
   │  FALLBACK: Geographic Batching              │
   │  (always available)                         │
   ├─────────────────────────────────────────────┤
   │  • Deterministic ZIP-based grouping         │
   │  • Groups orders by ZIP code                │
   │  • Splits large groups (>max_size)          │
   │  • Flags small groups (<min_size) as        │
   │    subsidized (platform absorbs cost)       │
   │  • Fast, predictable, reliable              │
   └─────────────────────────────────────────────┘

5. Create delivery_batch records in database
6. Assign box codes to orders (e.g., B1-1, B1-2, ...)
7. Update order status to 'confirmed'
8. Return batch summary (count, method used, subsidization)
```

**Why This Matters for YC Demo**:
- ✅ **Reliability**: Doesn't depend on external AI uptime
- ✅ **Engineering Maturity**: Shows thoughtful fallback strategy
- ✅ **Transparency**: Returns which method was used + why
- ✅ **Cost-Conscious**: Flags subsidized batches for visibility

### 3. Driver Route Completion

```
1. Driver views available batches (filters by delivery date)
2. Driver claims batch (status: assigned)
3. Driver loads boxes at collection point
4. Driver scans box codes (QR/barcode) to confirm pickup
5. Driver navigates optimized route (sorted by proximity)
6. At each stop:
   ├─► Driver marks order as 'delivered'
   ├─► (Optional) Customer signs/photos
   └─► Status updates via Supabase Realtime
7. Driver completes batch
8. Payout record created (delivery_fee + tips)
```

## 🧪 Testing Strategy

### Unit Tests (`src/lib/__tests__/`)
- Pure utility functions
- Money calculations, credits, delivery fees
- **Fast**: No external dependencies
- **Run**: `npm test`

### Integration Tests (`e2e/`)
- Edge functions with Playwright
- Tests:
  - `checkout-flow.spec.ts`: Full checkout process
  - `driver-workflow.spec.ts`: Route assignment and completion
  - `order-cutoff.spec.ts`: Cutoff time validation
  - `auth-roles.spec.ts`: Role-based access control
- **Run**: `npm run test:e2e`

### Manual Testing
- Use seed script to create test data: `npm run seed`
- Test accounts created for each role (consumer, farmer, driver, admin)

## 🔧 Environment Setup

### Required Secrets (Critical - App Won't Start Without These)

Set in **Lovable Cloud Secrets UI**:

| Secret                      | Description                    | Impact if Missing          |
|-----------------------------|--------------------------------|----------------------------|
| `STRIPE_SECRET_KEY`         | Backend Stripe API key         | ❌ Payments fail            |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access           | ❌ Edge functions fail      |

### Optional Secrets (Enhanced Functionality)

| Secret                | Description                 | Impact if Missing                      |
|-----------------------|-----------------------------|----------------------------------------|
| `MAPBOX_PUBLIC_TOKEN` | Address geocoding           | ⚠️  Falls back to ZIP-based coordinates |
| `LOVABLE_API_KEY`     | AI batch optimization       | ⚠️  Uses geographic fallback algorithm  |

### Frontend Environment Variables

Auto-configured by Lovable Cloud:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_STRIPE_PUBLISHABLE_KEY`

See `.env.example` for detailed descriptions.

## 📊 Key Metrics & KPIs

### Operational Metrics
- **Order Success Rate**: % of successful checkouts
- **Batch Fill Rate**: Avg orders per batch (target: 15)
- **Subsidization Rate**: % of batches below minimum size
- **Delivery Accuracy**: % of on-time deliveries

### Financial Metrics
- **Revenue Split Accuracy**: Automated validation of 88/2/10 split
- **Driver Earnings**: Delivery fees + tips per route
- **Platform Revenue**: 10% of product sales + delivery fees
- **Credit Redemption Rate**: % of orders using credits

### AI Optimization Metrics
- **AI Success Rate**: % of batches optimized via AI vs. fallback
- **Route Efficiency**: AI-optimized vs. geographic routes
- **Optimization Confidence**: AI-provided score (0-1)

## 🐛 Debugging Guide

### Edge Function Logs

View in **Lovable Cloud dashboard** → Functions → [function-name] → Logs

Logs are structured with prefixes:
```
[CHECKOUT] Order created: abc-123
[BATCH_GEN] ✅ AI optimization successful: 5 batches for 73 orders
[BATCH_GEN] ⚠️  AI rate limit exceeded (429) - using fallback batching
```

### Common Issues

| Error                          | Cause                       | Solution                                      |
|--------------------------------|-----------------------------|-----------------------------------------------|
| "STRIPE_SECRET_KEY not found"  | Missing secret              | Add in Lovable Cloud Secrets UI               |
| "MAPBOX_TOKEN not configured"  | Missing secret              | Add secret OR ignore (uses ZIP fallback)      |
| "Batch optimization failed"    | AI rate limit / credits     | ⚠️  Automatic fallback to geographic method    |
| "UNAUTHORIZED"                 | Invalid/expired JWT         | Re-authenticate user                          |
| "TOO_MANY_REQUESTS"            | Rate limit exceeded         | Wait for `Retry-After` seconds                |
| "INSUFFICIENT_INVENTORY"       | Product out of stock        | Update cart with available quantity           |

### Network Debugging

Browser DevTools → Network tab:
- Check request payloads (should match Zod schemas)
- Check response status codes (200, 400, 401, 429, 500)
- Check `Authorization` header (should be `Bearer <jwt>`)

### Database Debugging

Lovable Cloud → Database → Run queries:
```sql
-- Check order status
SELECT id, status, total_amount, delivery_date FROM orders WHERE consumer_id = 'user-id';

-- Check batch assignments
SELECT ob.id, db.batch_number, db.status 
FROM orders ob 
JOIN delivery_batches db ON ob.delivery_batch_id = db.id;

-- Check payout records
SELECT * FROM payouts WHERE payee_id = 'user-id' ORDER BY created_at DESC;
```

## 🚢 Deployment

### Auto-Deployment
- **Trigger**: Git push to main branch
- **What Deploys**: All edge functions automatically
- **Downtime**: Zero (blue-green deployment)
- **Rollback**: Revert git commit to roll back functions

### Pre-Deployment Checklist
- [ ] Run tests: `npm test && npm run test:e2e`
- [ ] Verify secrets configured in Lovable Cloud
- [ ] Check database migrations applied
- [ ] Test critical flows in staging

### Post-Deployment Validation
- [ ] Check edge function logs for errors
- [ ] Test checkout flow end-to-end
- [ ] Verify batch generation runs successfully
- [ ] Monitor error rates in Sentry (if configured)

## 📚 Further Reading

- [Lovable Cloud Documentation](https://docs.lovable.dev/features/cloud)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Query Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)
- [Zod Schema Validation](https://zod.dev/)

---

*Last updated: 2025-11-01*  
*Architecture designed for clarity, maintainability, and scalability.*
