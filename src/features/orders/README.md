# Orders Feature

Centralized module for order management including checkout, tracking, cancellation, and delivery status updates.

## Structure

```
orders/
├── hooks/            # React hooks
│   └── useActiveOrder.ts
├── queries/          # React Query hooks
│   └── index.ts
├── types/            # TypeScript types
│   └── index.ts
├── errors.ts         # Feature-specific errors
└── index.ts          # Public exports
```

## Hooks

### useActiveOrder
Tracks consumer's active order with real-time updates.

**Props:** None (uses auth context)

**Returns:**
- `activeOrder: OrderWithDetails | null` - Current active order
- `isLoading: boolean` - Loading state

**Features:**
- Automatic polling every 30 seconds
- Real-time Supabase subscription for instant updates
- Fetches order items, driver info, and delivery address
- Only returns orders with status: confirmed, in_transit, or out_for_delivery

**Usage:**
```tsx
import { useActiveOrder } from '@/features/orders';

const { activeOrder, isLoading } = useActiveOrder();

if (activeOrder?.status === 'out_for_delivery') {
  // Show live tracking UI
}
```

## Types

### Order
```typescript
interface Order {
  id: string;
  consumer_id: string;
  status: 'pending' | 'confirmed' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled';
  total_amount: number;
  delivery_date: string;
  box_code: string | null;
  created_at: string;
  updated_at: string;
}
```

### OrderItem
```typescript
interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}
```

### OrderWithDetails
Extended order type with related data for tracking and display.

```typescript
interface OrderWithDetails extends Order {
  order_items: Array<{
    quantity: number;
    products: {
      name: string;
      unit: string;
    };
  }>;
  delivery_batches: {
    driver_id: string;
    estimated_duration_minutes: number | null;
    profiles: {
      full_name: string;
      phone: string | null;
    };
  } | null;
  profiles: {
    street_address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  };
}
```

## Query Keys

```typescript
export const orderQueries = {
  all: () => ['orders'] as const,
  byUser: (userId: string) => [...orderQueries.all(), 'user', userId] as const,
  active: (userId: string) => [...orderQueries.all(), 'active', userId] as const,
  detail: (orderId: string) => [...orderQueries.all(), 'detail', orderId] as const,
  history: (userId: string, filters?: Record<string, unknown>) =>
    [...orderQueries.all(), 'history', userId, filters] as const,
};
```

## Error Handling

```typescript
import { 
  createCheckoutError,
  createPaymentError,
  createOrderNotFoundError,
  createOrderCancelError,
  createOrderTrackingError
} from '@/features/orders';

// Usage examples
throw createCheckoutError('Failed to process checkout');
throw createPaymentError('Payment declined');
throw createOrderNotFoundError('Order ID not found');
throw createOrderCancelError('Cannot cancel delivered order');
throw createOrderTrackingError('Failed to load tracking data');
```

## Business Logic

### Order Lifecycle

1. **Pending** - Order created, awaiting batch assignment
2. **Confirmed** - Assigned to delivery batch, box code generated
3. **In Transit** - Driver claimed batch, en route to collection point
4. **Out for Delivery** - Driver picked up boxes, delivering to consumers
5. **Delivered** - Order successfully delivered
6. **Cancelled** - Order cancelled by consumer or admin

### Box Code System

- Format: `B{batch_number}-{stop_sequence}`
- Generated when order is assigned to delivery batch
- Used for:
  - Loading verification at collection point
  - Delivery confirmation at consumer address
  - Order tracking and identification

### Real-time Updates

Orders automatically update through:
- **Polling**: Every 30 seconds (configurable via POLLING_INTERVALS)
- **Subscriptions**: Instant updates via Supabase realtime
- Tracks changes to order status, batch assignment, and delivery progress

## Pages Using This Feature

- `/consumer/checkout` - Create new orders
- `/consumer/order-tracking` - Track active order status
- `/consumer/order-success` - Order confirmation page
- `/consumer/live-tracking` - Real-time delivery tracking
- `/admin/dashboard` - Admin order management

## Related Features

- **Cart**: Order creation from cart items
- **Products**: Order items reference products
- **Drivers**: Delivery batch and driver assignment
- **Consumers**: Order history and tracking
- **Payouts**: Revenue distribution to farmers and drivers

## Edge Functions

### checkout
Processes order creation with payment validation.

**Endpoint:** `/checkout`  
**Auth:** Required (consumer)  
**Service:** `CheckoutService`

### cancel-order
Cancels pending or confirmed orders.

**Endpoint:** `/cancel-order`  
**Auth:** Required (consumer or admin)

## Security Considerations

- Orders are scoped to authenticated users via RLS
- Payment processing through Stripe for PCI compliance
- Order cancellation restricted by status (cannot cancel delivered orders)
- Box codes are unique per delivery batch
- Driver addresses revealed progressively (see Address Privacy System)
