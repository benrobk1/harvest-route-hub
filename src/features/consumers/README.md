# Consumers Feature

## Overview
The Consumers feature manages all consumer-facing functionality including shopping, credits, referrals, subscriptions, and order management.

## Structure

```
consumers/
├── components/       # Consumer UI components
│   ├── CreditsBreakdown.tsx      # Credits dashboard and breakdown
│   ├── DriverRating.tsx          # Rate delivery drivers
│   ├── EmptyOrderState.tsx       # Empty state for no active orders
│   ├── InfoBanner.tsx            # Shop information banner
│   ├── ProductGrid.tsx           # Product listing grid
│   ├── QuantitySelector.tsx      # Product quantity selector
│   ├── ReferralBanner.tsx        # Referral program banner
│   ├── ReferralManager.tsx       # Referral code management
│   ├── ReferralModal.tsx         # Share referral modal
│   ├── ShopHeader.tsx            # Shop page header with navigation
│   ├── SpendingProgressCard.tsx  # Monthly spending progress
│   └── SubscriptionManager.tsx   # Subscription management
├── queries/          # Query key factories
├── errors.ts         # Consumer error creators
└── index.ts          # Public exports

```

## Components

### CreditsBreakdown
Displays detailed breakdown of consumer's credits including:
- Current balance
- Monthly spending
- Credits earned this month
- Available next month
- Recent transactions

**Props**: None (uses auth context)

**Usage**:
```tsx
import { CreditsBreakdown } from '@/features/consumers';

<CreditsBreakdown />
```

### DriverRating
Allows consumers to rate their delivery driver after an order.

**Props**:
- `orderId: string` - Order ID
- `driverId: string` - Driver ID
- `driverName?: string` - Driver's name
- `onRatingSubmitted?: () => void` - Callback after rating submission

**Usage**:
```tsx
import { DriverRating } from '@/features/consumers';

<DriverRating 
  orderId={orderId}
  driverId={driverId}
  driverName="John Doe"
  onRatingSubmitted={() => refetch()}
/>
```

### EmptyOrderState
Empty state component shown when consumer has no active orders.

**Props**: None

**Usage**:
```tsx
import { EmptyOrderState } from '@/features/consumers';

{!activeOrder && <EmptyOrderState />}
```

### InfoBanner
Displays key information about the service (minimum order, delivery fee, credits).

**Props**: None

**Usage**:
```tsx
import { InfoBanner } from '@/features/consumers';

<InfoBanner />
```

### ProductGrid
Renders a grid of product cards with loading states and empty states.

**Props**:
- `products: Product[]` - Array of products
- `isLoading: boolean` - Loading state
- `searchQuery: string` - Current search query
- `onAddToCart: (product: Product, quantity: number) => void` - Add to cart handler
- `farmerData?: Record<string, unknown>` - Farmer profile data
- `consumerProfile?: { zip_code?: string } | null` - Consumer profile

**Usage**:
```tsx
import { ProductGrid } from '@/features/consumers';

<ProductGrid
  products={products}
  isLoading={isLoading}
  searchQuery={search}
  onAddToCart={handleAddToCart}
  farmerData={farmerProfiles}
  consumerProfile={profile}
/>
```

### QuantitySelector
Reusable quantity selector with increment/decrement buttons.

**Props**:
- `quantity: number` - Current quantity
- `onIncrement: () => void` - Increment handler
- `onDecrement: () => void` - Decrement handler
- `disabled?: boolean` - Disable buttons

**Usage**:
```tsx
import { QuantitySelector } from '@/features/consumers';

<QuantitySelector
  quantity={quantity}
  onIncrement={() => setQuantity(q => q + 1)}
  onDecrement={() => setQuantity(q => Math.max(1, q - 1))}
/>
```

### ReferralBanner
Promotional banner encouraging users to refer friends.

**Props**:
- `onOpenModal: () => void` - Callback to open referral modal

**Usage**:
```tsx
import { ReferralBanner } from '@/features/consumers';

<ReferralBanner onOpenModal={() => setShowModal(true)} />
```

### ReferralManager
Full referral management dashboard with code sharing and statistics.

**Props**: None (uses auth context)

**Usage**:
```tsx
import { ReferralManager } from '@/features/consumers';

<ReferralManager />
```

### ReferralModal
Modal dialog for sharing referral code via various methods.

**Props**:
- `open: boolean` - Modal open state
- `onOpenChange: (open: boolean) => void` - Modal state change handler

**Usage**:
```tsx
import { ReferralModal } from '@/features/consumers';

<ReferralModal 
  open={isOpen}
  onOpenChange={setIsOpen}
/>
```

### ShopHeader
Main shop page header with search, navigation, and cart.

**Props**:
- `searchQuery: string` - Current search query
- `onSearchChange: (value: string) => void` - Search handler
- `marketConfig?: { cutoff_time, delivery_days }` - Market configuration

**Usage**:
```tsx
import { ShopHeader } from '@/features/consumers';

<ShopHeader
  searchQuery={search}
  onSearchChange={setSearch}
  marketConfig={config}
/>
```

### SpendingProgressCard
Shows progress toward monthly spending goal for earning credits.

**Props**: None (uses auth context)

**Usage**:
```tsx
import { SpendingProgressCard } from '@/features/consumers';

<SpendingProgressCard />
```

### SubscriptionManager
Manages consumer's monthly subscription with trial support.

**Props**: None (uses auth context)

**Usage**:
```tsx
import { SubscriptionManager } from '@/features/consumers';

<SubscriptionManager />
```

## Queries

Consumer queries are defined in `queries/index.ts`:

```typescript
import { consumerQueries } from '@/features/consumers';

// Query key factories
consumerQueries.profile(userId)
consumerQueries.subscription(userId)
consumerQueries.creditsBreakdown(userId)
```

## Error Handling

Consumer-specific errors:

```typescript
import { createConsumerError } from '@/features/consumers';

throw createConsumerError('Failed to load profile');
```

## Dependencies

- Auth context for user authentication
- Cart feature for shopping cart functionality
- Products feature for product data
- Orders feature for order management
- Supabase for backend operations

## Security Considerations

- All components handle authentication through AuthContext
- Subscription status is refreshed to prevent stale data
- Referral codes are unique per user
- Credits are tracked server-side for integrity
