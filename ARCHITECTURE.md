# Blue Harvests Architecture Guide

**Last Updated**: November 2025  
**Code Quality Initiative Status**: ✅ Phases 1, 2, 4, 5 Complete | 🔄 Phase 3 In Progress

## 📋 Migration Summary

### Completed Phases
- ✅ **Phase 1**: Standardized Query Keys - All React Query keys use factory pattern
- ✅ **Phase 2**: Feature Migration - All 8 features migrated to `src/features/`
- ✅ **Phase 4**: Error Handling - Standardized error types & useErrorHandler hook
- ✅ **Phase 5**: Documentation - JSDoc complete, all feature READMEs complete

### Remaining Work
**Middleware Application** (Phase 3):
- ⏳ Apply `composeMiddleware` to all edge functions (currently only utilities exist)
- ⏳ Update `checkout`, `generate-batches`, `process-payouts` to use composition pattern
- ⏳ Migrate remaining functions: `claim-route`, `stripe-webhook`, `send-notification`
- ⏳ Address privacy system documentation

---

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

#### `/features` - **Feature Modules (Phase 2 - Partially Complete)**
Feature-based architecture with colocated code:

**Migrated Features** (✅):
- **Cart** (`/cart`): Shopping cart, saved carts, cart actions
  - Components: CartDrawer, SaveCartDialog, SavedCartsList
  - Hooks: useCart, useCartActions
  - Types: CartItem, ShoppingCart, SavedCart
  - Queries: cartQueries
- **Orders** (`/orders`): Order management and tracking
  - Hooks: useActiveOrder
  - Types: Order, OrderItem, OrderWithDetails
  - Queries: orderQueries
- **Products** (`/products`): Product catalog and search
  - Hooks: useShopProducts, useProductSearch
  - Types: Product, ProductWithFarmer, ShopData
  - Queries: productQueries
- **Consumers** (`/consumers`): Consumer shopping experience, credits, subscriptions
  - Components: CreditsBreakdown, DriverRating, EmptyOrderState, InfoBanner, ProductGrid, QuantitySelector, ReferralBanner, ReferralManager, ReferralModal, ShopHeader, SpendingProgressCard, SubscriptionManager
  - Queries: consumerQueries
  - Errors: createConsumerError
- **Payouts** (`/payouts`): Financial transactions and earnings tracking
  - Components: PayoutsDashboard, PayoutDetailsTable, PayoutHistoryChart
  - Queries: payoutQueries
  - Errors: createPayoutError
- **Drivers** (`/drivers`): Route claiming, delivery tracking, box scanning
  - Components: AvailableRoutes, BoxCodeScanner, RouteDensityMap, DriverInterface
  - Types: Stop, VerifiedOrder, DeliveryBatch
  - Queries: driversKeys
  - Errors: createDriverError
- **Farmers** (`/farmers`): Inventory management, batch coordination, product management
  - Components: BatchConsolidation, BoxCodeDisplay, BulkEditDialog, CSVProductImport, LeadFarmerInfoCard, MultiFarmDashboard, NextOrderCutoffCard, ProductForm, StripeConnectSimple, ValidationPreviewTable, WeeklyInventoryReview
  - Queries: farmerQueries
  - Errors: createFarmerError
- **Admin** (`/admin`): User management, system monitoring, tax documents
  - Components: AdminRoleManager, CreditsManager, FarmAffiliationManager, KPIHeader, TaxDocumentGenerator, UserRatingDisplay
  - Queries: adminQueries
  - Errors: createAdminError

Each feature exports a clean public API via `index.ts`

#### `/pages` - Route Components
- **Consumer**: Shop, Checkout, Order Tracking, Profile
- **Farmer**: Dashboard, Inventory Management, Financials, Analytics
- **Driver**: Available Routes, Route Details, Payout Details
- **Admin**: Dashboard, User Approvals, Product Approval, Analytics

#### `/components` - Shared UI Components
- **UI Components** (`/ui`): shadcn components (Button, Card, Dialog, etc.)
- **Feature Components**: Shared components not tied to a specific feature
- **Role-Specific** (`/farmer`, `/driver`, `/consumer`, `/admin`): Role-based features

#### `/contracts` - Zod Schemas
- Shared validation between frontend and backend
- Single source of truth for request/response shapes
- Runtime validation + compile-time types
- Files: `checkout.ts`, `batching.ts`, `payouts.ts`, `subscription.ts`

#### `/config` - Configuration & Constants
- `env.ts`: Client-side environment validation (fail-fast on missing vars)
- `constants.ts`: Business rules (revenue splits, fees, limits)
- `ui-constants.ts`: UI-specific constants (polling intervals, etc.)

#### `/hooks` - Shared Custom React Hooks
- Shared hooks not tied to specific features
- Authentication, toasts, mobile detection

#### `/lib` - Pure Utility Functions
- Money formatting, distance calculations, date helpers
- Error handling and tracking
- No side effects, easily testable

#### `/integrations/supabase` - **Auto-Generated (DO NOT EDIT)**
- `client.ts`: Supabase client instance
- `types.ts`: Database types from schema

### Backend (`supabase/functions/`)

#### `/_shared` - **Shared Modules**
- **`/middleware`**: Composable request handlers (**utilities created, not yet applied**)
  - `withAuth.ts`: JWT validation
  - `withAdminAuth.ts`: Admin role verification
  - `withCORS.ts`: CORS validation and headers
  - `withValidation.ts`: Request schema validation
  - `withRateLimit.ts`: Rate limiting per user
  - `withRequestId.ts`: Request ID tracking for logs
  - `withErrorHandling.ts`: Structured error responses
  - **`compose.ts`**: Middleware composition utility
  - **`index.ts`**: Centralized middleware exports
  - **⚠️ STATUS**: Utilities exist but are **not yet applied** to edge functions
- **`/services`**: Business logic services
  - `CheckoutService.ts`: Order processing logic
  - `BatchOptimizationService.ts`: AI and geographic batching
  - `PayoutService.ts`: Payout processing logic
- **`/contracts`**: Shared Zod schemas (re-exported from src)
- **`config.ts`**: Environment loading with fail-fast validation
- **`constants.ts`**: Server-side business rules
- `rateLimiter.ts`: Rate limit implementation

#### `/[function-name]` - Edge Function Handlers
- **Current Pattern**: Manual middleware implementation (Phase 3 not yet applied)
- **Target Pattern**: `composeMiddleware([withErrorHandling, withCORS, withAuth])(handler)`
- **Alternative Pattern**: `createMiddlewareStack()` for explicit ordering
- Functions: `checkout`, `optimize-delivery-batches`, `generate-batches`, `process-payouts`, etc.
- **⚠️ TODO**: Migrate all functions to use middleware composition

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

### Operational Safety: Driver Address Privacy (Progressive Disclosure)

**Critical Design Decision**: Driver addresses are hidden until pickup confirmation to prevent operational abuse and protect consumer privacy.

For complete technical documentation, see **[Address Privacy System](./SECURITY.md#address-privacy-model)**.

---

#### Quick Overview

The address privacy system implements **progressive disclosure**: consumer addresses are revealed to drivers incrementally as they make delivery progress. This prevents route cherry-picking, protects consumer privacy, and ensures operational fairness.

**Data Flow:**
```
Order Creation → Batch Assignment → Driver Claims Route → Box Scan at Collection → Address Revealed → Delivery → Next 3 Addresses Unlocked
```

---

#### Implementation Summary

**Database Layer:**
- `batch_stops.address_visible_at` - NULL until box scanned at collection point
- `update_address_visibility()` trigger - Unlocks next 3 addresses on delivery progress
- `get_consumer_address()` function - Enforces access control at query level

**Application Layer:**
- `BoxCodeScanner.tsx` - Sets `address_visible_at` when driver scans box
- `DriverInterface.tsx` - Shows/hides addresses based on visibility status
- `RouteDetails.tsx` - Displays ZIP code only before pickup, full address after

**Security Benefits:**
1. **Prevents Cherry-Picking** - Drivers can't see addresses before claiming routes
2. **Privacy Protection** - Consumer addresses hidden until pickup confirmation
3. **Operational Fairness** - All drivers see identical route information
4. **Fraud Prevention** - Address visibility tied to physical action (box scan)

---

#### Progressive Disclosure Workflow

1. **Route Claiming Phase**
   - Driver sees: ZIP codes, batch size, collection point address
   - Driver does NOT see: Individual consumer addresses

2. **Box Loading Phase**
   - Driver arrives at collection point
   - Scans box code for first delivery
   - Trigger fires: First address + next 3 addresses become visible

3. **Delivery Phase**
   - Driver completes delivery, marks stop as delivered
   - Trigger fires: Next 3 addresses become visible
   - Process repeats until all deliveries complete

4. **Completion**
   - All addresses eventually visible for route completion
   - Historical address data retained for support/disputes

---

#### Code Examples

**Frontend - Address Visibility Check:**
```typescript
// drivers/components/DriverInterface.tsx
const { data: stops } = useQuery({
  queryKey: ['batch-stops', batchId],
  queryFn: async () => {
    const { data } = await supabase
      .from('batch_stops')
      .select('*, orders(consumer_id, profiles(street_address, zip_code))')
      .eq('delivery_batch_id', batchId);
    
    return data?.map(stop => ({
      ...stop,
      addressVisible: !!stop.address_visible_at,
    }));
  },
});

// Render logic
{stops.map(stop => (
  <StopCard>
    <Address>
      {stop.addressVisible 
        ? stop.orders.profiles.street_address 
        : 'Address Hidden'}
    </Address>
  </StopCard>
))}
```

**Backend - Box Scan Handler:**
```typescript
// supabase/functions/scan-box/index.ts
await supabase
  .from('batch_stops')
  .update({ 
    address_visible_at: new Date().toISOString(),
    status: 'in_progress'
  })
  .eq('order_id', orderId);
```

For detailed database implementation, RLS policies, and troubleshooting, see **[SECURITY.md](./SECURITY.md#address-privacy-model)**.

## 📊 Observability & Error Tracking

### Request Tracing

Every edge function request receives a unique UUID for correlated logging across the entire request lifecycle.

**Implementation:**
- **Middleware**: `withRequestId` generates UUID and injects into context
- **Log format**: `[requestId] [FUNCTION] message`
- **Propagation**: Request ID passed through service layer
- **Correlation**: All logs for a single request share the same ID

**Example trace:**
```
[a1b2c3d4] [CHECKOUT] Request started: POST /functions/v1/checkout
[a1b2c3d4] [CHECKOUT] Processing checkout for user 123
[a1b2c3d4] [CHECKOUT] Payment breakdown: subtotal=$50, delivery=$7.50, tip=$2.00
[a1b2c3d4] [CHECKOUT] Stripe payment intent created: pi_abc123
[a1b2c3d4] [CHECKOUT] ✅ Success: order 456
[a1b2c3d4] [CHECKOUT] Request completed: 200 (543ms)
```

**Why This Matters:**
- ✅ **Production-Ready**: Industry-standard observability pattern
- ✅ **Debuggability**: Trace individual requests through complex flows
- ✅ **Performance**: Measure request duration at middleware level
- ✅ **Error Correlation**: Link errors to specific user actions

### Error Tracking (Sentry)

Sentry integration hooks are prepared but disabled by default for demo simplicity.

**Client-Side Tracking:**
- Configured in `src/lib/sentry.ts`
- Session replay with privacy masking (`maskAllText: true`)
- Breadcrumb tracking (console, DOM, fetch, history)
- User context tracking (ID, email, role)

**Server-Side Hooks:**
- Error capture in `withErrorHandling` middleware
- Request ID correlation via tags
- Stack trace logging (dev mode only)
- **Disabled by default** - set `SENTRY_DSN` to enable

**Configuration:**
```bash
# Enable Sentry (optional, disabled by default)
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**Why Disabled by Default:**
- ✅ **Demo-Friendly**: No external dependencies for reviewers
- ✅ **Privacy**: No data sent to third-party without explicit opt-in
- ✅ **Prepared**: Hooks in place, easy to enable post-demo
- ✅ **Thoughtful**: Shows production thinking without over-engineering

## 🔄 Key Workflow Diagrams

### Checkout & Payment Flow

```mermaid
sequenceDiagram
    participant C as Consumer
    participant UI as Frontend
    participant CheckoutFn as checkout Function
    participant CheckoutSvc as CheckoutService
    participant Stripe as Stripe API
    participant DB as Database
    
    C->>UI: Click "Place Order"
    UI->>UI: Validate cart (min $25)
    
    UI->>CheckoutFn: POST /checkout
    Note over CheckoutFn: Middleware: Auth → RateLimit → Validation
    
    CheckoutFn->>DB: Fetch cart & items
    CheckoutFn->>DB: Validate inventory availability
    
    CheckoutFn->>CheckoutSvc: processCheckout()
    
    CheckoutSvc->>CheckoutSvc: Calculate totals<br/>(subtotal + delivery + tip)
    
    CheckoutSvc->>CheckoutSvc: Calculate revenue splits<br/>88% farmer | 2% lead | 10% platform
    
    CheckoutSvc->>DB: Create inventory_reservations
    
    CheckoutSvc->>Stripe: Create PaymentIntent
    Stripe-->>CheckoutSvc: client_secret
    
    CheckoutSvc->>DB: Store payment_intent
    CheckoutSvc->>DB: Create order (status: pending)
    CheckoutSvc->>DB: Create order_items (snapshot prices)
    CheckoutSvc->>DB: Create transaction_fees records
    CheckoutSvc->>DB: Create payout records (status: pending)
    
    CheckoutSvc-->>CheckoutFn: Return client_secret + order_id
    CheckoutFn-->>UI: 200 OK with client_secret
    
    UI->>Stripe: confirmPayment() via Stripe.js
    Stripe-->>UI: Payment success
    
    UI->>C: Navigate to /order-success?id={order_id}
    
    Note over Stripe,DB: Async webhook flow
    Stripe->>CheckoutFn: stripe-webhook (payment_intent.succeeded)
    CheckoutFn->>DB: Update order status → confirmed
    CheckoutFn->>DB: Update payment_intent → succeeded
    CheckoutFn->>DB: Clear inventory_reservations
    CheckoutFn->>DB: Deduct product inventory
```

### Batch Generation & Route Optimization Flow

```mermaid
sequenceDiagram
    participant Cron as Scheduled Job
    participant BatchFn as generate-batches Function
    participant BatchSvc as BatchOptimizationService
    participant LovableAI as Lovable AI
    participant OSRM as OSRM/Mapbox
    participant DB as Database
    
    Cron->>BatchFn: Trigger daily (6 AM)
    Note over BatchFn: Process tomorrow's orders
    
    BatchFn->>DB: Fetch pending orders<br/>WHERE delivery_date = tomorrow
    DB-->>BatchFn: Orders with addresses
    
    BatchFn->>BatchSvc: optimizeBatches(delivery_date)
    
    BatchSvc->>BatchSvc: Group orders by collection point<br/>(lead farmer locations)
    
    alt AI Optimization Available (has LOVABLE_API_KEY)
        BatchSvc->>LovableAI: POST /ai/batch-optimization
        Note over LovableAI: gemini-2.5-flash-lite<br/>Optimize: distance + density + fairness
        LovableAI-->>BatchSvc: Optimized batches + routes
        Note over BatchSvc: AI batches marked as<br/>is_subsidized: false
    else Fallback: Geographic Clustering
        BatchSvc->>BatchSvc: Geographic clustering by ZIP code
        Note over BatchSvc: Group orders within same ZIP<br/>Target: 30-45 orders per batch
        BatchSvc->>BatchSvc: Fallback batches marked as<br/>is_subsidized: true (platform cost)
    end
    
    loop For each batch
        BatchSvc->>OSRM: POST /route/v1/driving/<br/>coordinates[]
        OSRM-->>BatchSvc: Optimized route geometry + timing
        
        BatchSvc->>DB: INSERT delivery_batches<br/>(lead_farmer_id, delivery_date, zip_codes)
        DB-->>BatchSvc: batch_id
        
        BatchSvc->>DB: INSERT batch_stops (sequence_number, address, coords)
        Note over DB: First 3 stops: address_visible_at = now()<br/>Rest: address_visible_at = NULL
        
        BatchSvc->>DB: INSERT batch_metadata<br/>(ai_optimization_data, is_subsidized)
        
        BatchSvc->>DB: UPDATE orders<br/>SET delivery_batch_id, status = 'confirmed'
        
        BatchSvc->>DB: Generate box_codes<br/>(B{batch_number}-{stop_sequence})
    end
    
    BatchSvc-->>BatchFn: Result: {batches_created, optimization_method}
    BatchFn-->>Cron: 200 OK with summary
```

### Driver Delivery Workflow

```mermaid
sequenceDiagram
    participant D as Driver
    participant UI as Mobile UI
    participant ClaimFn as claim-route Function
    participant DB as Database
    participant Scanner as BoxCodeScanner
    participant StopTrigger as update_address_visibility Trigger
    
    D->>UI: View Available Routes
    UI->>DB: Fetch delivery_batches<br/>WHERE status = 'pending'<br/>AND driver_id IS NULL
    DB-->>UI: Available batches (ZIP codes only)
    
    D->>UI: Claim Route
    UI->>ClaimFn: POST /claim-route<br/>{batch_id}
    ClaimFn->>DB: UPDATE delivery_batches<br/>SET driver_id = auth.uid(), status = 'assigned'
    ClaimFn->>DB: INSERT routes (status: assigned)
    ClaimFn-->>UI: 200 OK
    
    D->>UI: Navigate to Route Details
    UI->>DB: Fetch batch_stops<br/>WHERE address_visible_at IS NOT NULL
    Note over UI: Shows first 3 addresses only<br/>Rest show "ZIP: 12345"
    
    D->>D: Arrive at collection point
    
    loop For each delivery box
        D->>Scanner: Scan QR code (B3-1)
        Scanner->>DB: UPDATE batch_stops<br/>SET address_visible_at = now(),<br/>status = 'in_progress'<br/>WHERE order_id = {parsed_order_id}
        
        Scanner->>DB: INSERT delivery_scan_logs<br/>(scan_type: 'pickup', box_code, location)
        
        Note over StopTrigger: Trigger fires on UPDATE
        StopTrigger->>DB: UPDATE batch_stops<br/>SET address_visible_at = now()<br/>WHERE sequence_number IN (current+1, current+2, current+3)
        
        Scanner-->>D: ✅ Pickup confirmed<br/>Next 3 addresses unlocked
    end
    
    D->>UI: Start Navigation
    
    loop For each stop
        D->>D: Drive to address
        D->>UI: Mark Arrived
        UI->>DB: UPDATE batch_stops<br/>SET actual_arrival = now()
        
        D->>UI: Upload delivery proof<br/>(photo, signature)
        UI->>DB: INSERT delivery_proofs<br/>(batch_stop_id, photo_url, signature_url)
        
        D->>UI: Mark Delivered
        UI->>DB: UPDATE batch_stops<br/>SET status = 'delivered'
        
        Note over StopTrigger: Trigger fires again
        StopTrigger->>DB: Reveal next 3 addresses
        
        UI->>DB: UPDATE orders<br/>SET status = 'delivered'
    end
    
    D->>UI: Complete Route
    UI->>DB: UPDATE delivery_batches<br/>SET status = 'completed'
    UI->>DB: UPDATE routes<br/>SET status = 'completed', completed_at = now()
    
    Note over UI,DB: Triggers payout processing
```

### Payout Processing Flow

```mermaid
sequenceDiagram
    participant Cron as Scheduled Job
    participant PayoutFn as process-payouts Function
    participant PayoutSvc as PayoutService
    participant Stripe as Stripe Connect
    participant DB as Database
    
    Cron->>PayoutFn: Trigger (after delivery completion)
    
    PayoutFn->>PayoutSvc: processPendingPayouts()
    
    PayoutSvc->>DB: SELECT * FROM payouts<br/>WHERE status = 'pending'<br/>AND stripe_connect_account_id IS NOT NULL
    DB-->>PayoutSvc: Pending payouts with order status
    
    loop For each payout
        alt Order not delivered
            PayoutSvc->>PayoutSvc: Skip (order status != 'delivered')
            Note over PayoutSvc: Count as skipped
        else Order delivered
            PayoutSvc->>Stripe: accounts.retrieve(connect_account_id)
            Stripe-->>PayoutSvc: Account details
            
            alt Payouts not enabled
                PayoutSvc->>DB: UPDATE payouts<br/>SET status = 'failed'<br/>description = 'PAYOUTS_NOT_ENABLED'
                Note over PayoutSvc: Count as failed<br/>Requires Connect onboarding
            else Payouts enabled
                PayoutSvc->>PayoutSvc: Calculate amount<br/>Farmer: 88% of product subtotal<br/>Lead Farmer: 2% commission<br/>Driver: $7.50 per delivery
                
                PayoutSvc->>Stripe: transfers.create({<br/>  amount: amount * 100,<br/>  destination: connect_account_id,<br/>  metadata: {payout_id, order_id}<br/>})
                
                alt Transfer succeeds
                    Stripe-->>PayoutSvc: transfer_id
                    PayoutSvc->>DB: UPDATE payouts<br/>SET status = 'completed',<br/>stripe_transfer_id = transfer_id,<br/>completed_at = now()
                    Note over PayoutSvc: Count as successful
                else Transfer fails
                    Stripe-->>PayoutSvc: Error (insufficient balance, restricted account)
                    PayoutSvc->>DB: UPDATE payouts<br/>SET status = 'failed',<br/>description = error.message
                    Note over PayoutSvc: Count as failed<br/>Requires manual review
                end
            end
        end
    end
    
    PayoutSvc-->>PayoutFn: Result: {successful, failed, skipped, errors[]}
    PayoutFn-->>Cron: 200 OK with summary
    
    Note over DB: Farmers/drivers see payouts<br/>in dashboard via RLS policies
```

### Subscription & Credits Flow

```mermaid
sequenceDiagram
    participant C as Consumer
    participant UI as Frontend
    participant SubFn as create-subscription-checkout Function
    participant Stripe as Stripe Billing
    participant Webhook as stripe-webhook Function
    participant DB as Database
    participant CheckoutFn as checkout Function
    
    C->>UI: Click "Subscribe ($0/month)"
    UI->>SubFn: POST /create-subscription-checkout
    
    SubFn->>Stripe: customers.create({email, metadata})
    Stripe-->>SubFn: customer_id
    
    SubFn->>Stripe: checkout.sessions.create({<br/>  mode: 'subscription',<br/>  line_items: [{price_id, quantity: 1}],<br/>  subscription_data: {trial_period_days: 30}<br/>})
    Stripe-->>SubFn: checkout_session_url
    
    SubFn-->>UI: Redirect to Stripe Checkout
    
    C->>Stripe: Complete Stripe Checkout
    Stripe-->>C: Redirect to success_url
    
    Stripe->>Webhook: subscription.created
    Webhook->>DB: INSERT subscriptions<br/>({consumer_id, stripe_subscription_id,<br/>status: 'trialing', trial_end: +30 days})
    
    Note over C: 30-day trial begins<br/>Earns credits on orders
    
    C->>UI: Place order ($100)
    UI->>CheckoutFn: POST /checkout
    
    CheckoutFn->>DB: Check subscription status
    alt Has active subscription
        CheckoutFn->>DB: Calculate credits earned<br/>$10 per $100 spent
        CheckoutFn->>DB: INSERT credits_ledger<br/>({amount: 10, transaction_type: 'earned',<br/>balance_after: current + 10,<br/>expires_at: +12 months})
        CheckoutFn->>DB: UPDATE subscriptions<br/>SET monthly_spend += 100,<br/>credits_earned += 10
    end
    
    Note over C: Next month, credits available
    
    C->>UI: Place order ($50)
    UI->>CheckoutFn: POST /checkout<br/>{credits_to_use: 1}
    
    CheckoutFn->>DB: Check available credits<br/>WHERE expires_at > now()
    CheckoutFn->>CheckoutFn: Apply discount<br/>$50 - $10 = $40 charged
    
    CheckoutFn->>DB: INSERT credits_ledger<br/>({amount: -10, transaction_type: 'redeemed',<br/>balance_after: current - 10})
    
    CheckoutFn->>Stripe: Create PaymentIntent($40)
    
    Note over C: Trial ends after 30 days
    Stripe->>Webhook: subscription.trial_ended
    Webhook->>DB: UPDATE subscriptions<br/>SET status = 'active'
    
    Note over C: Subscription continues free<br/>Keeps earning 10% credits
```

### Referral Program Flow

```mermaid
sequenceDiagram
    participant R as Referrer
    participant UI as Frontend
    participant Referee as New User
    participant AuthFn as Auth Flow
    participant DB as Database
    participant CheckoutFn as checkout Function
    
    R->>UI: View Referral Code
    UI->>DB: SELECT referral_code FROM profiles<br/>WHERE id = auth.uid()
    DB-->>UI: "BH4F8A2C9D"
    
    R->>Referee: Share referral code
    
    Referee->>UI: Sign up with code
    UI->>AuthFn: signUp({email, password, metadata: {referral_code}})
    
    AuthFn->>DB: Check referral code exists
    DB-->>AuthFn: Referrer profile found
    
    AuthFn->>DB: INSERT INTO profiles<br/>(Referee created via trigger)
    
    AuthFn->>DB: INSERT INTO referrals<br/>({referrer_id, referee_id,<br/>status: 'pending',<br/>credit_amount: 25})
    
    AuthFn-->>Referee: Account created
    
    Note over Referee: Browse products, add to cart
    
    Referee->>UI: Place first order
    UI->>CheckoutFn: POST /checkout
    
    CheckoutFn->>DB: Check for pending referral<br/>WHERE referee_id = auth.uid()<br/>AND status = 'pending'
    
    alt First order found
        CheckoutFn->>DB: UPDATE referrals<br/>SET status = 'credited',<br/>referee_first_order_id = order_id,<br/>credited_at = now()
        
        CheckoutFn->>DB: INSERT credits_ledger<br/>({consumer_id: referrer_id,<br/>amount: 25, transaction_type: 'referral_bonus',<br/>balance_after: current + 25,<br/>expires_at: +12 months})
        
        CheckoutFn->>DB: INSERT credits_ledger<br/>({consumer_id: referee_id,<br/>amount: 25, transaction_type: 'referral_bonus',<br/>balance_after: 25,<br/>expires_at: +12 months})
        
        Note over R,Referee: Both receive $25 credit
    end
    
    CheckoutFn-->>Referee: Order placed + Welcome bonus!
```

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
