# Payouts Feature

## Overview
The Payouts feature manages financial transactions and earnings tracking for farmers and drivers, including payout history, charts, and detailed transaction tables.

## Structure

```
payouts/
├── components/       # Payout UI components
│   ├── PayoutsDashboard.tsx      # Earnings overview with stats
│   ├── PayoutDetailsTable.tsx    # Detailed transaction table
│   └── PayoutHistoryChart.tsx    # 30-day earnings chart
├── queries/          # Query key factories
├── errors.ts         # Payout error creators
└── index.ts          # Public exports
```

## Components

### PayoutsDashboard
Main dashboard showing earnings overview with key statistics.

**Features**:
- Total earnings (all time)
- Pending payouts amount and count
- Completed payouts total
- Recent payout transactions list
- Status badges (completed, pending, failed)

**Props**: None (queries all payouts for current user)

**Usage**:
```tsx
import { PayoutsDashboard } from '@/features/payouts';

<PayoutsDashboard />
```

**Data Structure**:
```typescript
interface Payout {
  id: string;
  amount: number;
  status: 'completed' | 'pending' | 'failed';
  description: string;
  created_at: string;
  completed_at: string | null;
  stripe_transfer_id: string | null;
}
```

### PayoutDetailsTable
Detailed table view of payout transactions.

**Props**:
- `recipientType: 'farmer' | 'driver' | 'lead_farmer_commission'` - Filter by recipient type

**Usage**:
```tsx
import { PayoutDetailsTable } from '@/features/payouts';

<PayoutDetailsTable recipientType="driver" />
```

**Features**:
- Date formatting
- Description display
- Amount with currency formatting
- Status badges
- Responsive table layout
- Loading skeleton

### PayoutHistoryChart
Bar chart visualizing earnings over the last 30 days.

**Props**:
- `recipientType: 'farmer' | 'driver' | 'lead_farmer_commission'` - Filter by recipient type

**Usage**:
```tsx
import { PayoutHistoryChart } from '@/features/payouts';

<PayoutHistoryChart recipientType="farmer" />
```

**Features**:
- Daily earnings aggregation
- Responsive chart sizing
- Custom tooltips with formatted amounts
- Empty state for no data
- Automatic date grouping

**Chart Configuration**:
- Time range: Last 30 days
- Data grouping: By day
- Status filter: Only completed payouts
- Chart type: Bar chart with rounded corners

## Queries

Payout queries are defined in `queries/index.ts`:

```typescript
import { payoutQueries } from '@/features/payouts';

// Query key factories
payoutQueries.all()                              // All payouts
payoutQueries.details(userId, recipientType)     // Filtered by user and type
payoutQueries.history(userId, recipientType)     // 30-day history
```

## Error Handling

Payout-specific errors:

```typescript
import { createPayoutError } from '@/features/payouts';

throw createPayoutError('Failed to load payout details');
```

## Integration Points

### With Stripe Connect
- Payouts are processed through Stripe Connect
- `stripe_transfer_id` links to Stripe transfer records
- Status synced from Stripe webhooks

### With User Roles
- **Farmers**: Receive payouts for product sales
- **Drivers**: Receive payouts for delivery fees
- **Lead Farmers**: Receive commission payouts

### Database Schema
The payouts table includes:
- `id`: UUID primary key
- `recipient_id`: Foreign key to user
- `recipient_type`: Enum ('farmer', 'driver', 'lead_farmer_commission')
- `amount`: Decimal (payout amount)
- `status`: Enum ('pending', 'completed', 'failed')
- `description`: Text (transaction description)
- `stripe_transfer_id`: Text (Stripe reference)
- `created_at`: Timestamp
- `completed_at`: Timestamp (nullable)

## Usage Examples

### Farmer Profile Page
```tsx
import { PayoutsDashboard } from '@/features/payouts';

function FarmerProfile() {
  return (
    <Tabs>
      <TabsContent value="payouts">
        <PayoutsDashboard />
      </TabsContent>
    </Tabs>
  );
}
```

### Driver Payout Details Page
```tsx
import { 
  PayoutHistoryChart, 
  PayoutDetailsTable 
} from '@/features/payouts';

function PayoutDetails() {
  return (
    <>
      <PayoutHistoryChart recipientType="driver" />
      <PayoutDetailsTable recipientType="driver" />
    </>
  );
}
```

## Dependencies

- Auth context for user authentication
- Supabase for payout data queries
- Recharts for chart visualization
- date-fns for date formatting
- React Query for data fetching

## Performance Considerations

- **Lazy Loading**: PayoutHistoryChart can be lazy loaded via `LazyChart.tsx`
- **Query Limits**: Recent payouts limited to 10-20 records
- **Time Range**: Historical charts limited to 30 days
- **Caching**: React Query caching by user ID and recipient type

## Security

- All payout queries filtered by authenticated user ID
- RLS policies enforce row-level security
- Recipient type validation prevents cross-role access
- Stripe transfer IDs kept secure (not displayed to users)
