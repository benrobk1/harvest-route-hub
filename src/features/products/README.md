# Products Feature

Centralized module for product catalog management including search, filtering, inventory tracking, and farmer associations.

## Structure

```
products/
├── hooks/            # React hooks
│   ├── useProductSearch.ts
│   └── useShopProducts.ts
├── queries/          # React Query hooks
│   └── index.ts
├── types/            # TypeScript types
│   └── index.ts
├── errors.ts         # Feature-specific errors
└── index.ts          # Public exports
```

## Hooks

### useProductSearch
Client-side product search with performance optimizations.

**Props:**
- `products: Product[]` - Array of products to search

**Returns:**
- `searchQuery: string` - Current search query
- `setSearchQuery: (value: string) => void` - Update search query
- `filteredProducts: Product[]` - Filtered product results

**Features:**
- Searches across product names and farm names
- Uses `useDeferredValue` for non-blocking search
- Preloads images for top 3 results
- Case-insensitive matching

**Usage:**
```tsx
import { useProductSearch } from '@/features/products';

const { searchQuery, setSearchQuery, filteredProducts } = useProductSearch(products);

<input 
  value={searchQuery} 
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Search products or farms..."
/>

{filteredProducts.map(product => (
  <ProductCard key={product.id} product={product} />
))}
```

### useShopProducts
Fetches shop products with associated farmer and market data.

**Props:** None (uses auth context)

**Returns:**
- `products: Product[]` - Available shop products
- `isLoading: boolean` - Loading state
- `farmerData: Record<string, unknown>` - Farmer profile data by farm_profile_id
- `consumerProfile: { zip_code: string } | null` - Current user's profile
- `marketConfig: MarketConfig | null` - Market configuration for user's ZIP

**Features:**
- Only returns approved products with available inventory
- Batches farmer profile queries for efficiency
- Caches data for 5 minutes
- Includes market configuration (delivery fees, cutoff times, etc.)

**Usage:**
```tsx
import { useShopProducts } from '@/features/products';

const { products, farmerData, marketConfig, isLoading } = useShopProducts();

products.forEach(product => {
  const farmer = farmerData?.[product.farm_profile_id];
  // Render product with farmer info
});
```

## Types

### Product
```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  available_quantity: number;
  image_url: string | null;
  farm_profile_id: string;
  harvest_date: string | null;
  farm_profiles: {
    id: string;
    farm_name: string;
    location: string | null;
  };
}
```

### ProductWithFarmer
Extended product type including farmer profile data.

```typescript
interface ProductWithFarmer extends Product {
  farmer_data?: {
    avatar_url: string | null;
    full_name: string;
  };
}
```

### ShopData
Aggregated shop data including products, farmers, and market configuration.

```typescript
interface ShopData {
  products: Product[];
  farmerData: Record<string, unknown>;
  consumerProfile: {
    zip_code: string | null;
  } | null;
  marketConfig: {
    cutoff_time: string | null;
    delivery_days: string[] | null;
  } | null;
}
```

## Query Keys

```typescript
export const productQueries = {
  all: () => ['products'] as const,
  shop: () => [...productQueries.all(), 'shop'] as const,
  detail: (productId: string) => [...productQueries.all(), 'detail', productId] as const,
  farmers: (farmProfileIds: string[]) => ['farmers-batch', farmProfileIds] as const,
  marketConfig: (zipCode: string) => ['market-config-shop', zipCode] as const,
};
```

## Error Handling

```typescript
import { 
  createProductLoadError,
  createProductSearchError,
  createProductApprovalError
} from '@/features/products';

// Usage examples
throw createProductLoadError('Failed to load products');
throw createProductSearchError('Search query failed');
throw createProductApprovalError('Product approval failed');
```

## Business Logic

### Product Approval Workflow

1. Farmer creates product (status: `pending`)
2. Admin reviews product details and images
3. Admin approves product (status: `approved`)
4. Product becomes visible in shop with inventory > 0

### Inventory Management

- Products with `available_quantity > 0` are shown in shop
- Inventory decrements on order creation
- Out-of-stock products hidden from shop automatically
- Farmers can update inventory in their dashboard

### Pricing Rules

- Prices set by farmers
- Server-side validation prevents price tampering
- Platform fee: 10% of subtotal
- Farmer receives: 88% of product price
- Lead farmer commission: 2% of product price

## Components Using This Feature

- `ProductCard` - Individual product display
- `ProductGrid` - Grid layout for shop
- `ProductForm` - Farmer product creation/editing
- `CSVProductImport` - Bulk product import for farmers
- `BulkEditDialog` - Batch update product inventory

## Pages Using This Feature

- `/consumer/shop` - Main shop page with all products
- `/farmer/inventory` - Farmer product management
- `/admin/product-approval` - Admin product review
- `/farm-profile/:id` - Farm profile with product listings

## Related Features

- **Farmers**: Product creation and inventory management
- **Cart**: Adding products to shopping cart
- **Orders**: Order items reference products
- **Admin**: Product approval workflow
- **Consumers**: Browsing and purchasing products

## Edge Functions

None - Products are managed through direct Supabase queries.

## Security Considerations

- Product approval required before shop visibility
- RLS policies ensure farmers can only edit their own products
- Price validation on server-side during checkout
- Inventory checks prevent overselling
- Image uploads validated and stored in secure buckets
- Search operations client-side only (no SQL injection risk)

## Performance Optimizations

- Farmer data batched to avoid N+1 queries
- Product images preloaded for top search results
- 5-minute cache for shop products
- Deferred search value for non-blocking UI
- Image lazy loading for product cards
