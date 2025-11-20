# Development Standards & Best Practices

## Code Quality Standards

### TypeScript Standards

#### Type Safety
- **Always use explicit types** for function parameters and return values
- **Avoid loose typing** - use `unknown` or proper types when flexibility is needed
- **Use strict mode** - already enabled in `tsconfig.json`
- **Leverage type inference** where types are obvious

```typescript
// ❌ Bad
function processOrder(order: unknown) {
  const unsafeOrder = order as { total?: number };
  return unsafeOrder.total;
}

// ✅ Good
function processOrder(order: Order): number {
  return order.total;
}

// ✅ Good - type inference
const products = items.map(item => item.product); // Product[] inferred
```

#### Interface vs Type

Use **interfaces** for objects that can be extended:
```typescript
interface User {
  id: string;
  email: string;
}

interface Consumer extends User {
  address: string;
}
```

Use **types** for unions, intersections, or primitives:
```typescript
type Role = 'consumer' | 'farmer' | 'driver' | 'admin';
type Status = 'pending' | 'confirmed' | 'delivered';
```

### React Standards

#### Component Structure

```typescript
// 1. Imports (grouped and organized)
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';

// 2. Types/Interfaces
interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string, quantity: number) => void;
}

// 3. Component
export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  // 3a. Hooks
  const [quantity, setQuantity] = useState(1);
  const { data } = useQuery({ ... });

  // 3b. Event handlers
  const handleAddToCart = () => {
    onAddToCart(product.id, quantity);
  };

  // 3c. Effects
  useEffect(() => {
    // side effects
  }, []);

  // 3d. Early returns
  if (!product) return null;

  // 3e. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

#### Hooks Best Practices

1. **Custom Hooks**: Extract reusable logic
```typescript
// ✅ Good - reusable hook
function useProductSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['products', 'search', searchTerm],
    queryFn: () => searchProducts(searchTerm),
    enabled: searchTerm.length > 0
  });
}
```

2. **Dependencies**: Always specify complete dependency arrays
```typescript
// ❌ Bad
useEffect(() => {
  fetchData(userId);
}, []); // Missing userId dependency

// ✅ Good
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

3. **Memoization**: Use wisely, not everywhere
```typescript
// ✅ Use for expensive calculations
const sortedProducts = useMemo(
  () => products.sort((a, b) => a.price - b.price),
  [products]
);

// ❌ Don't over-optimize
const name = useMemo(() => user.name, [user]); // Unnecessary
```

### State Management

#### React Query for Server State

```typescript
// ✅ Consistent query keys
const QUERY_KEYS = {
  products: ['products'],
  productById: (id: string) => ['products', id],
  orders: ['orders'],
  ordersByUser: (userId: string) => ['orders', 'user', userId]
};

// ✅ Reusable queries
export function useProducts() {
  return useQuery({
    queryKey: QUERY_KEYS.products,
    queryFn: fetchProducts,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}
```

#### Local State with useState/useReducer

```typescript
// Simple state - use useState
const [isOpen, setIsOpen] = useState(false);

// Complex state - use useReducer
const [cart, dispatch] = useReducer(cartReducer, initialCart);
```

### Error Handling

#### Consistent Error Handling

```typescript
// ✅ Custom error classes
export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

// ✅ Error boundaries for components
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>

// ✅ Try-catch for async operations
async function processPayment(paymentInfo: PaymentInfo) {
  try {
    const result = await stripe.processPayment(paymentInfo);
    return { success: true, data: result };
  } catch (error) {
    console.error('Payment processing failed:', error);
    captureException(error); // Sentry
    return { success: false, error: getErrorMessage(error) };
  }
}
```

### File Organization

```
src/
├── features/           # Feature-based modules
│   ├── cart/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── queries/
│   │   ├── types/
│   │   ├── errors.ts
│   │   ├── index.ts    # Public API
│   │   └── README.md
│   └── ...
├── components/         # Shared components
│   ├── ui/            # Design system
│   └── ...
├── lib/               # Utilities
├── pages/             # Route components
└── types/             # Shared types
```

### Naming Conventions

#### Files
- **Components**: PascalCase - `ProductCard.tsx`
- **Hooks**: camelCase with 'use' prefix - `useCart.ts`
- **Utilities**: camelCase - `formatMoney.ts`
- **Types**: camelCase - `index.ts`, `types.ts`
- **Constants**: UPPER_SNAKE_CASE - `constants.ts`

#### Variables & Functions
```typescript
// Components - PascalCase
function ProductCard() {}

// Hooks - camelCase with 'use'
function useProductSearch() {}

// Utilities - camelCase
function formatMoney() {}

// Constants - UPPER_SNAKE_CASE
const MAX_CART_ITEMS = 50;

// Boolean variables - is/has/should prefix
const isLoading = true;
const hasPermission = false;
const shouldRender = true;

// Event handlers - handle prefix
const handleClick = () => {};
const handleSubmit = () => {};
```

### Code Style

#### Formatting
- **Indentation**: 2 spaces
- **Line length**: Max 100 characters
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing commas**: Always in multiline

#### Comments
```typescript
// ❌ Bad - obvious comment
// Set loading to true
setLoading(true);

// ✅ Good - explains why
// Preload images to prevent flash on transition
await preloadImages(productImages);

// ✅ Good - documents complex logic
/**
 * Calculate delivery fee based on distance and order total.
 * Free delivery for orders over $50 within 10 miles.
 * @param distance - Distance in miles
 * @param orderTotal - Order total in cents
 */
function calculateDeliveryFee(distance: number, orderTotal: number): number {
  if (orderTotal >= 5000 && distance <= 10) return 0;
  return Math.max(500, distance * 100);
}
```

## Testing Standards

### Test Coverage Requirements
- **Minimum coverage**: 70% for all metrics
- **Critical paths**: 90%+ coverage required
- **New features**: Must include tests before merge

### Test Structure
```typescript
describe('Feature: Cart Management', () => {
  describe('Adding items', () => {
    it('should add item to empty cart', () => {
      // Arrange
      const cart = createEmptyCart();
      const product = createTestProduct();
      
      // Act
      const result = addItemToCart(cart, product, 1);
      
      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe(product.id);
    });
  });
});
```

### What to Test
✅ **Do test**:
- Business logic
- User interactions
- Error conditions
- Edge cases
- Integration between features

❌ **Don't test**:
- Implementation details
- Third-party libraries
- Framework internals
- Trivial getters/setters

## Performance Standards

### Frontend Performance

#### Bundle Size
- **Main bundle**: < 500KB gzipped
- **Vendor chunks**: Code split by route
- **Images**: Optimized and lazy loaded
- **Fonts**: Self-hosted, preloaded

#### Loading Performance
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Cumulative Layout Shift**: < 0.1

```typescript
// ✅ Code splitting
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

// ✅ Image optimization
<img 
  src={optimizeImage(url, { width: 400 })} 
  loading="lazy"
  alt="Product"
/>

// ✅ Memoization for expensive renders
const MemoizedProductList = memo(ProductList);
```

### Backend Performance

#### Database Queries
- **Simple queries**: < 100ms
- **Complex queries**: < 500ms
- **Indexed fields**: All foreign keys and frequent filters

```sql
-- ✅ Add indexes for performance
CREATE INDEX idx_orders_consumer_id ON orders(consumer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

#### Edge Functions
- **Response time**: < 1s for 95th percentile
- **Cold start**: < 2s
- **Memory usage**: < 256MB

## Security Standards

### Authentication & Authorization
```typescript
// ✅ Always verify user permissions
export async function updateOrder(orderId: string, userId: string) {
  const order = await getOrder(orderId);
  
  if (order.consumer_id !== userId) {
    throw new ForbiddenError('Not authorized to update this order');
  }
  
  // proceed with update
}
```

### Data Validation
```typescript
// ✅ Validate all inputs
import { z } from 'zod';

const checkoutSchema = z.object({
  cartItems: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100)
  })).min(1),
  deliveryAddress: z.string().min(10),
});

// Validate before processing
const validated = checkoutSchema.parse(input);
```

### Sensitive Data
```typescript
// ✅ Never log sensitive data
console.log('Processing payment', { 
  orderId: payment.orderId,
  // ❌ Don't log: cardNumber, cvv, etc.
});

// ✅ Mask sensitive fields
const maskedCard = `****-****-****-${last4}`;
```

## Git Standards

### Commit Messages
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples**:
```
feat(cart): add quantity selector to product cards

- Added QuantitySelector component
- Updated ProductCard to include selector
- Added tests for quantity validation

Closes #123
```

### Branch Strategy
- `main`: Production-ready code
- `develop`: Development branch
- `feature/*`: New features
- `fix/*`: Bug fixes
- `hotfix/*`: Urgent production fixes

### Pull Requests
- **Title**: Clear, descriptive
- **Description**: What, why, how
- **Tests**: All tests passing
- **Review**: At least one approval
- **Size**: < 400 lines changed (split larger PRs)

## Documentation Standards

### Code Documentation
```typescript
/**
 * Calculate the total price for a cart including fees and taxes.
 * 
 * @param cart - The shopping cart
 * @param deliveryFee - Delivery fee in cents
 * @returns Total price in cents
 * 
 * @example
 * const total = calculateCartTotal(cart, 500);
 * // Returns: 4250 (cart: $37.50 + delivery: $5.00)
 */
export function calculateCartTotal(
  cart: Cart, 
  deliveryFee: number
): number {
  // implementation
}
```

### Feature Documentation
Each feature should have a `README.md`:
```markdown
# Cart Feature

## Overview
Shopping cart management with persistence and validation.

## Components
- `CartDrawer`: Main cart UI
- `CartItem`: Individual cart item

## Hooks
- `useCart`: Cart state management
- `useCartActions`: Cart CRUD operations

## API
See `types/index.ts` for type definitions.
```

## Accessibility Standards

### Semantic HTML
```tsx
// ✅ Use semantic elements
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Page Title</h1>
  </article>
</main>
```

### ARIA Labels
```tsx
// ✅ Add labels for screen readers
<button aria-label="Add to cart">
  <ShoppingCart />
</button>

<input 
  type="text"
  aria-label="Search products"
  placeholder="Search..."
/>
```

### Keyboard Navigation
```tsx
// ✅ Support keyboard interaction
<div 
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

## Review Checklist

Before submitting code:
- [ ] TypeScript types are explicit and correct
- [ ] Tests are written and passing
- [ ] Code follows naming conventions
- [ ] Error handling is implemented
- [ ] Performance considerations addressed
- [ ] Security best practices followed
- [ ] Documentation is updated
- [ ] Accessibility standards met
- [ ] No console.log statements
- [ ] Linter passes with no warnings
