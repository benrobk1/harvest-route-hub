# Repository Abstraction Layer

This directory implements the **Repository Pattern** to decouple data access logic from the rest of the application, reducing vendor lock-in and improving testability.

## 📁 Structure

```
src/repositories/
├── interfaces/           # Repository contracts (interfaces)
│   ├── IProductRepository.ts
│   ├── ICartRepository.ts
│   └── IOrderRepository.ts
├── supabase/            # Supabase-specific implementations
│   ├── SupabaseProductRepository.ts
│   ├── SupabaseCartRepository.ts
│   └── SupabaseOrderRepository.ts
├── factory.ts           # Singleton factory for repository instances
└── index.ts            # Central export point
```

## 🎯 Benefits

### 1. **Reduced Vendor Lock-in**
All Supabase-specific code is isolated in `repositories/supabase/`. To switch to a different backend:
1. Create new implementations (e.g., `repositories/firebase/`)
2. Update `factory.ts` to return new instances
3. **Zero changes needed** in components/hooks

### 2. **Improved Testability**
Mock repositories easily in tests:
```typescript
import { resetRepositories } from '@/repositories';

// In test setup
const mockProductRepo: IProductRepository = {
  getShopProducts: vi.fn().mockResolvedValue([]),
  // ...
};
```

### 3. **Single Responsibility**
- **Repositories**: Handle data access only
- **Hooks**: Handle React Query integration, caching, and state management
- **Components**: Handle UI rendering

## 🔧 Usage

### In Hooks
```typescript
import { getProductRepository } from '@/repositories';

export const useShopProducts = () => {
  const productRepo = getProductRepository();

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => productRepo.getShopProducts(),
  });

  return { products };
};
```

### Creating New Repositories

#### 1. Define Interface
```typescript
// repositories/interfaces/IUserRepository.ts
export interface IUserRepository {
  getUserById(userId: string): Promise<User>;
  updateUser(userId: string, data: Partial<User>): Promise<void>;
}
```

#### 2. Implement for Supabase
```typescript
// repositories/supabase/SupabaseUserRepository.ts
import { supabase } from '@/integrations/supabase/client';
import type { IUserRepository } from '../interfaces/IUserRepository';

export class SupabaseUserRepository implements IUserRepository {
  async getUserById(userId: string): Promise<User> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update(userData)
      .eq('id', userId);
    
    if (error) throw error;
  }
}
```

#### 3. Add to Factory
```typescript
// repositories/factory.ts
import { SupabaseUserRepository } from './supabase/SupabaseUserRepository';

let userRepository: IUserRepository | null = null;

export const getUserRepository = (): IUserRepository => {
  if (!userRepository) {
    userRepository = new SupabaseUserRepository();
  }
  return userRepository;
};
```

#### 4. Export from Index
```typescript
// repositories/index.ts
export type { IUserRepository } from './interfaces/IUserRepository';
export { getUserRepository } from './factory';
```

## 🔄 Migration Path

To switch from Supabase to another backend (e.g., Firebase):

1. Create `repositories/firebase/` directory
2. Implement each interface for Firebase:
   ```typescript
   // repositories/firebase/FirebaseProductRepository.ts
   export class FirebaseProductRepository implements IProductRepository {
     async getShopProducts(): Promise<Product[]> {
       const snapshot = await getDocs(collection(db, 'products'));
       return snapshot.docs.map(doc => doc.data() as Product);
     }
     // ...
   }
   ```

3. Update factory:
   ```typescript
   // repositories/factory.ts
   import { FirebaseProductRepository } from './firebase/FirebaseProductRepository';
   
   export const getProductRepository = (): IProductRepository => {
     if (!productRepository) {
       productRepository = new FirebaseProductRepository(); // Changed!
     }
     return productRepository;
   };
   ```

4. **Done!** All components and hooks automatically use Firebase

## ✅ Current Implementation Status

### Implemented Repositories
- ✅ **ProductRepository** - Shop products, farmer profiles, market config
- ✅ **CartRepository** - Shopping cart, cart items, saved carts
- ✅ **OrderRepository** - Active orders, order history, subscriptions

### Migrated Hooks
- ✅ `useShopProducts` - Uses ProductRepository
- ✅ `useCart` - Uses CartRepository
- ✅ `useActiveOrder` - Uses OrderRepository

### Pending Migration
- ⏳ Driver queries (routes, batches, earnings)
- ⏳ Farmer queries (inventory, payouts, affiliations)
- ⏳ Admin queries (users, approvals, analytics)

## 📝 Design Principles

### 1. **Interface Segregation**
Each repository has a focused interface with only the methods it needs.

### 2. **Dependency Inversion**
Hooks depend on interfaces, not concrete implementations:
```typescript
// ✅ Good - depends on interface
const repo: IProductRepository = getProductRepository();

// ❌ Bad - depends on concrete class
const repo = new SupabaseProductRepository();
```

### 3. **Singleton Pattern**
Repositories are singletons to avoid redundant instances:
```typescript
export const getProductRepository = (): IProductRepository => {
  if (!productRepository) {
    productRepository = new SupabaseProductRepository();
  }
  return productRepository; // Reuses same instance
};
```

### 4. **Error Handling**
Repositories throw errors; hooks handle them:
```typescript
// Repository
if (error) throw createCartError('Failed to load cart');

// Hook
onError: (error) => {
  handleError(error); // Toast notification, logging, etc.
}
```

## 🧪 Testing

### Mock Repository in Tests
```typescript
import { vi } from 'vitest';
import type { IProductRepository } from '@/repositories';

const mockProductRepo: IProductRepository = {
  getShopProducts: vi.fn().mockResolvedValue([
    { id: '1', name: 'Apple', price: 2.99 },
  ]),
  getFarmerProfiles: vi.fn().mockResolvedValue({}),
  getConsumerProfile: vi.fn().mockResolvedValue(null),
  getMarketConfig: vi.fn().mockResolvedValue(null),
  getProductById: vi.fn().mockResolvedValue(null),
};

// Inject mock in test
vi.mock('@/repositories', () => ({
  getProductRepository: () => mockProductRepo,
}));
```

## 📚 Further Reading

- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [Interface Segregation Principle](https://en.wikipedia.org/wiki/Interface_segregation_principle)
