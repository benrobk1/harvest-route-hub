# Migration Status - Blue Harvests

**Last Updated**: November 2025

This document tracks the progress of the ongoing code quality initiative and architecture refactoring.

## Quick Summary

| Phase | Status | Progress | Priority |
|-------|--------|----------|----------|
| Phase 1: Query Keys | ✅ Complete | 100% | - |
| **Phase 2** | Features | 🔄 In Progress | 62.5% (5/8 features) | HIGH |
| Phase 3: Middleware | 🔄 In Progress | 50% (utilities only) | MEDIUM |
| Phase 4: Error Handling | ✅ Complete | 100% | - |
| Phase 5: Documentation | 🔄 In Progress | 75% | LOW |

---

## Phase 1: Standardized Query Keys ✅

**Status**: Complete  
**Progress**: 100%

All React Query keys now use the factory pattern for consistency:

- ✅ `cartQueries` - Shopping cart queries
- ✅ `orderQueries` - Order management queries
- ✅ `productQueries` - Product catalog queries
- ✅ `consumerQueries` - Consumer profile and credits
- ✅ `farmerQueries` - Farmer dashboard and analytics
- ✅ `driverQueries` - Driver routes and payouts
- ✅ `adminQueries` - Admin dashboard and KPIs
- ✅ `payoutQueries` - Payout history and details

**Benefits Achieved**:
- Consistent cache invalidation patterns
- Type-safe query key generation
- Centralized query key documentation
- Easy debugging of cache state

---

## Phase 2: Feature-Based Architecture 🔄

**Status**: In Progress  
**Progress**: 62.5% (5 of 8 features migrated)

### ✅ Completed Features

#### 1. Cart Feature
- **Location**: `src/features/cart/`
- **Components**: CartDrawer, SaveCartDialog, SavedCartsList, CartItemSkeleton
- **Hooks**: useCart, useCartActions
- **Types**: CartItem, ShoppingCart, SavedCart, AddToCartData, etc.
- **Queries**: cartQueries
- **Errors**: createAddToCartError, createRemoveFromCartError, etc.
- **README**: ✅ Complete

#### 2. Orders Feature
- **Location**: `src/features/orders/`
- **Hooks**: useActiveOrder
- **Types**: Order, OrderItem, OrderWithDetails
- **Queries**: orderQueries
- **Errors**: createCheckoutError, createPaymentError, etc.

#### 3. Products Feature
- **Location**: `src/features/products/`
- **Hooks**: useShopProducts, useProductSearch
- **Types**: Product, ProductWithFarmer, ShopData
- **Queries**: productQueries
- **Errors**: createProductLoadError, createProductSearchError

#### 4. Consumers Feature
- **Location**: `src/features/consumers/`
- **Components**: CreditsBreakdown, DriverRating, EmptyOrderState, InfoBanner, ProductGrid, QuantitySelector, ReferralBanner, ReferralManager, ReferralModal, ShopHeader, SpendingProgressCard, SubscriptionManager
- **Queries**: consumerQueries
- **Errors**: createConsumerError
- **README**: ✅ Complete
- **Migration Notes**: All 12 components moved from `src/components/consumer/` to feature folder. All imports updated across the codebase.

#### 5. Payouts Feature
- **Location**: `src/features/payouts/`
- **Components**: PayoutsDashboard, PayoutDetailsTable, PayoutHistoryChart
- **Queries**: payoutQueries
- **Errors**: createPayoutError
- **README**: ✅ Complete
- **Migration Notes**: All 3 components moved from `src/components/` to feature folder. LazyChart.tsx updated to use new import path.

### ⏳ Pending Features

#### 6. Drivers Feature
- **Target**: `src/features/drivers/`
- **Current Location**: Scattered across `/components`, `/pages/driver`
- **Components to Migrate**: 
  - AvailableRoutes
  - BoxCodeScanner
  - RouteDensityMap
  - DriverInterface
- **Queries**: ✅ Already in `src/features/drivers/queries/`
- **README**: ✅ Complete
- **Estimated Effort**: 2-3 hours

#### 7. Farmers Feature
- **Target**: `src/features/farmers/`
- **Current Location**: Scattered across `/components`, `/pages/farmer`
- **Components to Migrate**:
  - BatchConsolidation
  - BoxCodeDisplay
  - BulkEditDialog
  - CSVProductImport
  - LeadFarmerInfoCard
  - MultiFarmDashboard
  - NextOrderCutoffCard
  - ProductForm
  - StripeConnectSimple
  - ValidationPreviewTable
  - WeeklyInventoryReview
- **Queries**: ✅ Already in `src/features/farmers/queries/`
- **README**: ✅ Complete
- **Estimated Effort**: 4-5 hours

#### 8. Admin Feature
- **Target**: `src/features/admin/`
- **Current Location**: Scattered across `/components`, `/pages/admin`
- **Components to Migrate**:
  - AdminRoleManager
  - CreditsManager
  - FarmAffiliationManager
  - KPIHeader
  - TaxDocumentGenerator
  - UserRatingDisplay
- **Queries**: ✅ Already in `src/features/admin/queries/`
- **Estimated Effort**: 3-4 hours

---

## Phase 3: Middleware Pattern 🔄

**Status**: In Progress  
**Progress**: 50% (utilities created, not applied)

### ✅ Middleware Utilities Created

All middleware utilities exist in `supabase/functions/_shared/middleware/`:

- ✅ `withAuth.ts` - JWT authentication and user context
- ✅ `withAdminAuth.ts` - Admin role verification
- ✅ `withCORS.ts` - CORS validation and headers
- ✅ `withErrorHandling.ts` - Structured error responses
- ✅ `withRateLimit.ts` - Rate limiting per user
- ✅ `withRequestId.ts` - Request ID for log correlation
- ✅ `withValidation.ts` - Zod schema validation
- ✅ `compose.ts` - Middleware composition utilities
- ✅ `index.ts` - Centralized exports

### ⏳ Edge Functions to Migrate

**Current Pattern** (Manual):
```typescript
serve(async (req) => {
  // Manual CORS check
  if (req.method === 'OPTIONS') { ... }
  
  // Manual auth
  const token = req.headers.get('Authorization');
  const user = await validateUser(token);
  
  // Manual rate limiting
  await checkRateLimit(user.id);
  
  // Business logic
  // ...
});
```

**Target Pattern** (Composed):
```typescript
import { composeMiddleware, withErrorHandling, withCORS, withAuth } from '../_shared/middleware/index.ts';

const handler = composeMiddleware([
  withErrorHandling,
  withCORS,
  withAuth,
  withRateLimit(RATE_LIMITS.CHECKOUT),
]);

serve(handler(async (req, ctx) => {
  // ctx.user already populated by withAuth
  // Business logic only
}));
```

### Functions Status

| Function | Status | Priority | Notes |
|----------|--------|----------|-------|
| checkout | ⏳ To Migrate | HIGH | Currently has inline middleware |
| optimize-delivery-batches | ⏳ To Migrate | HIGH | Uses withAdminAuth but not composition |
| generate-batches | ⏳ To Migrate | HIGH | Large function, good refactor candidate |
| process-payouts | ⏳ To Migrate | MEDIUM | Admin-only, straightforward |
| claim-route | ⏳ To Migrate | MEDIUM | Driver auth required |
| stripe-webhook | ⏳ To Migrate | LOW | No auth, just signature validation |
| send-notification | ⏳ To Migrate | LOW | Internal service call |
| send-cutoff-reminders | ⏳ To Migrate | LOW | CRON job |
| check-stripe-connect | ⏳ To Migrate | LOW | Simple check |
| award-credits | ⏳ To Migrate | LOW | Admin-only |

**Estimated Total Effort**: 6-8 hours for all functions

---

## Phase 4: Error Handling ✅

**Status**: Complete  
**Progress**: 100%

### ✅ Completed Work

- ✅ Created `BaseAppError` class with error codes
- ✅ Implemented `useErrorHandler` hook for centralized error handling
- ✅ Created feature-specific error creators:
  - `src/features/cart/errors.ts`
  - `src/features/orders/errors.ts`
  - `src/features/products/errors.ts`
  - `src/features/consumers/errors.ts`
  - `src/features/farmers/errors.ts`
  - `src/features/drivers/errors.ts`
  - `src/features/admin/errors.ts`
  - `src/features/payouts/errors.ts`
- ✅ Added comprehensive error handling documentation
- ✅ Integrated with Sentry for production error tracking (optional)

**Benefits Achieved**:
- Type-safe error creation
- Consistent user-facing error messages
- Improved debugging with error codes
- Centralized error logging

---

## Phase 5: Documentation 🔄

**Status**: In Progress  
**Progress**: 75%

### ✅ Completed Documentation

- ✅ JSDoc comments on all public APIs (utilities, hooks, error creators)
- ✅ Feature README for Cart
- ✅ Feature README for Drivers  
- ✅ Feature README for Farmers
- ✅ Error handling README
- ✅ Architecture guide (ARCHITECTURE.md)
- ✅ API documentation (API.md)

### ⏳ Pending Documentation

- ⏳ Feature README for Orders
- ⏳ Feature README for Products
- ⏳ Feature README for Admin
- ⏳ Feature README for Consumers
- ⏳ Feature README for Payouts
- ⏳ Inline comments for complex business logic (batch optimization, payout processing)
- ⏳ Address privacy system detailed documentation
- ⏳ CONTRIBUTING.md for developers

**Estimated Effort**: 3-4 hours

---

## Priority Roadmap

### Immediate (High Priority)

1. **Complete Phase 2** - Migrate remaining features
   - Start with Drivers (already has README and queries)
   - Then Farmers (has README and queries)
   - Estimated: 6-10 hours total

2. **Apply Middleware Composition** - Refactor edge functions
   - Start with checkout, optimize-delivery-batches, generate-batches
   - Estimated: 3-4 hours

### Near-Term (Medium Priority)

3. **Complete Feature READMEs** - Document remaining features
   - Orders, Products, Admin, Consumers, Payouts
   - Estimated: 2-3 hours

4. **Inline Documentation** - Add comments to complex systems
   - Batch optimization algorithm
   - Payout processing logic
   - Address privacy implementation
   - Estimated: 2-3 hours

### Long-Term (Low Priority)

5. **Developer Onboarding** - Create CONTRIBUTING.md
   - Code style guidelines
   - Commit conventions
   - Pull request process
   - Testing requirements
   - Estimated: 1-2 hours

---

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Features Migrated | 3/8 (37.5%) | 8/8 (100%) | 🔄 |
| Middleware Applied | 0/10 (0%) | 10/10 (100%) | 🔄 |
| Error Handling | 8/8 (100%) | 8/8 (100%) | ✅ |
| API Documentation | 100% | 100% | ✅ |
| JSDoc Coverage | 100% | 100% | ✅ |
| Feature READMEs | 3/8 (37.5%) | 8/8 (100%) | 🔄 |

---

## Notes for Developers

### Import Patterns After Migration

**Before (Scattered)**:
```typescript
import { useCart } from '@/hooks/useCart';
import { CartItem } from '@/types/domain/cart';
import { cartQueries } from '@/queries/cart';
import { CartDrawer } from '@/components/CartDrawer';
```

**After (Feature-Based)**:
```typescript
import { useCart, CartItem, cartQueries, CartDrawer } from '@/features/cart';
```

### Middleware Pattern

**Composition** (Recommended):
```typescript
const handler = composeMiddleware([
  withErrorHandling,  // Outermost
  withCORS,
  withAuth,           // Innermost
]);
```

**Stack** (Explicit ordering):
```typescript
const handler = createMiddlewareStack([
  withErrorHandling,  // Runs first
  withRequestId,
  withCORS,
  withAuth,          // Runs last
]);
```

### Testing After Migration

After migrating a feature or applying middleware:

1. ✅ Run TypeScript compiler: `npm run type-check`
2. ✅ Test all imports: `npm run build`
3. ✅ Run E2E tests: `npm run test:e2e`
4. ✅ Manual testing of affected flows
5. ✅ Check edge function logs for errors

---

## Questions or Issues?

If you encounter issues during migration or have questions about patterns:

1. Review the existing migrated features (cart, orders, products) as reference
2. Check `src/features/README.md` for architectural guidelines
3. Review middleware examples in `supabase/functions/_shared/middleware/`
4. Check `ARCHITECTURE.md` for system-wide patterns
