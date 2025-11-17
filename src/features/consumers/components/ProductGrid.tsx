import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';
import { Product } from '@/features/products';
import type { FarmerProfileWithUser } from '@/repositories/interfaces/IProductRepository';

interface ProductGridProps {
  products: Product[];
  isLoading: boolean;
  searchQuery: string;
  onAddToCart: (product: Product, quantity: number) => void;
  farmerData?: Record<string, FarmerProfileWithUser>;
  consumerProfile?: { zip_code?: string } | null;
}

export const ProductGrid = ({ 
  products, 
  isLoading, 
  searchQuery, 
  onAddToCart,
  farmerData,
  consumerProfile,
}: ProductGridProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {searchQuery ? 'No products match your search.' : 'No products available at the moment. Check back soon!'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          farmerData={farmerData?.[product.farm_profile_id]}
          consumerProfile={consumerProfile}
        />
      ))}
    </div>
  );
};
