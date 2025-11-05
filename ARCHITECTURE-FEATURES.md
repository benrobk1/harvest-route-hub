# Feature-Based Architecture

This document describes the feature-based architecture refactoring implemented in this project.

## Overview

The codebase has been reorganized into a feature-based structure where related code is colocated within feature modules. This improves maintainability, testability, and developer experience.

## Directory Structure

```
src/
├── features/           # Feature modules (new)
│   ├── cart/
│   │   ├── components/     # Cart-specific components
│   │   ├── hooks/          # Cart-specific hooks
│   │   ├── queries/        # TanStack Query factories
│   │   ├── types/          # Cart type definitions
│   │   └── index.ts        # Public API
│   ├── orders/
│   │   ├── hooks/
│   │   ├── queries/
│   │   ├── types/
│   │   └── index.ts
│   └── products/
│       ├── hooks/
│       ├── queries/
│       ├── types/
│       └── index.ts
├── components/         # Shared/generic components
├── hooks/             # Shared/generic hooks
├── lib/               # Utilities and helpers
├── queries/           # Remaining shared queries
└── types/             # Remaining shared types
```

## Feature Module Structure

Each feature module follows a consistent structure:

### 1. Types (`types/index.ts`)
Domain-specific type definitions and interfaces.

```typescript
// src/features/cart/types/index.ts
export interface CartItem { ... }
export interface ShoppingCart { ... }
```

### 2. Queries (`queries/index.ts`)
TanStack Query key factories for consistent cache management.

```typescript
// src/features/cart/queries/index.ts
export const cartQueries = {
  all: () => ['cart'] as const,
  current: (userId?: string) => [...cartQueries.all(), userId] as const,
};
```

### 3. Hooks (`hooks/`)
Feature-specific custom hooks.

```typescript
// src/features/cart/hooks/useCart.ts
export const useCart = () => {
  // Implementation
};
```

### 4. Components (`components/`)
Feature-specific UI components.

```typescript
// src/features/cart/components/CartDrawer.tsx
export const CartDrawer = () => {
  // Implementation
};
```

### 5. Public API (`index.ts`)
Centralized exports defining the feature's public interface.

```typescript
// src/features/cart/index.ts
export { useCart, useCartActions } from './hooks';
export { CartDrawer, SaveCartDialog } from './components';
export type { CartItem, ShoppingCart } from './types';
export { cartQueries } from './queries';
```

## Migrated Features

### ✅ Cart Feature
- **Location**: `src/features/cart/`
- **Components**: CartDrawer, SaveCartDialog, SavedCartsList, CartItemSkeleton
- **Hooks**: useCart, useCartActions
- **Types**: CartItem, ShoppingCart, SavedCart, etc.
- **Queries**: cartQueries

### ✅ Orders Feature
- **Location**: `src/features/orders/`
- **Hooks**: useActiveOrder
- **Types**: Order, OrderItem, OrderWithDetails
- **Queries**: orderQueries

### ✅ Products Feature
- **Location**: `src/features/products/`
- **Hooks**: useShopProducts, useProductSearch
- **Types**: Product, ProductWithFarmer, ShopData
- **Queries**: productQueries

## Import Patterns

### Before (Scattered)
```typescript
import { useCart } from '@/hooks/useCart';
import { CartItem } from '@/types/domain/cart';
import { cartQueries } from '@/queries/cart';
import { CartDrawer } from '@/components/CartDrawer';
```

### After (Feature-Based)
```typescript
import { useCart, CartItem, cartQueries, CartDrawer } from '@/features/cart';
```

## Edge Function Middleware Composition

### Middleware Utilities

Located in `supabase/functions/_shared/middleware/`:

- `withAuth.ts` - JWT authentication
- `withAdminAuth.ts` - Admin role verification
- `withCORS.ts` - CORS validation
- `withErrorHandling.ts` - Error catching and formatting
- `withRateLimit.ts` - Rate limiting
- `withRequestId.ts` - Request tracking
- `withValidation.ts` - Input validation
- `compose.ts` - Middleware composition utility

### Using Middleware Composition

```typescript
import { 
  composeMiddleware, 
  withErrorHandling, 
  withCORS, 
  withAuth 
} from '../_shared/middleware/index.ts';

// Compose middlewares (right to left execution)
const handler = composeMiddleware([
  withErrorHandling,  // Wraps everything
  withCORS,          // Runs second
  withAuth,          // Runs last (innermost)
]);

Deno.serve(handler(async (req, ctx) => {
  // Your handler logic with authenticated user in ctx.user
  return new Response(JSON.stringify({ data: 'Hello' }));
}));
```

### Alternative: createMiddlewareStack

For more explicit ordering:

```typescript
import { createMiddlewareStack } from '../_shared/middleware/index.ts';

// First middleware runs first (top to bottom)
const handler = createMiddlewareStack([
  withErrorHandling,  // Runs first (wraps everything)
  withRequestId,      // Runs second
  withCORS,          // Runs third
  withAuth,          // Runs fourth (innermost)
]);
```

## Benefits

### 1. **Improved Maintainability**
- Related code is colocated
- Clear boundaries between features
- Easier to understand dependencies

### 2. **Better Testability**
- Features can be tested in isolation
- Mock dependencies at feature boundaries
- Clear test structure matching code structure

### 3. **Enhanced Developer Experience**
- Single import statement per feature
- Clear public API via index.ts
- Autocomplete works better

### 4. **Scalability**
- New features follow established pattern
- Features can be developed independently
- Easier to identify and eliminate dead code

### 5. **Type Safety**
- Centralized type exports
- No circular dependencies
- Better IDE support

## Migration Guidelines

When adding new features or migrating existing code:

1. **Create the feature directory** under `src/features/[feature-name]/`
2. **Organize by concern**: types, queries, hooks, components
3. **Define public API** in `index.ts`
4. **Update imports** across the codebase
5. **Delete old files** after successful migration
6. **Update documentation** as needed

## Error Handling

All features use the centralized error handling system:

```typescript
import { useErrorHandler } from '@/lib/errors/useErrorHandler';
import { createCartError } from '@/lib/errors/ErrorTypes';

const { handleError } = useErrorHandler();

try {
  // Operation
} catch (error) {
  handleError(createCartError('Failed to add item'));
}
```

## Best Practices

1. **Keep features independent** - Minimize cross-feature imports
2. **Use the public API** - Only import from feature's `index.ts`
3. **Colocate related code** - Keep components, hooks, and types together
4. **Document public APIs** - Add JSDoc comments to exported functions
5. **Follow naming conventions** - Use consistent naming across features
6. **Minimize global state** - Encapsulate state within features when possible

## Future Improvements

- [ ] Migrate remaining features (drivers, farmers, admin)
- [ ] Add feature-level testing utilities
- [ ] Create feature templates for rapid scaffolding
- [ ] Add feature-level README files
- [ ] Implement feature flags system
- [ ] Add performance monitoring per feature
