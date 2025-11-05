import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCart } from "@/features/cart";
import { ReferralBanner } from "@/components/consumer/ReferralBanner";
import { ReferralModal } from "@/components/consumer/ReferralModal";
import { ShopHeader } from "@/components/consumer/ShopHeader";
import { InfoBanner } from "@/components/consumer/InfoBanner";
import { ProductGrid } from "@/components/consumer/ProductGrid";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useShopProducts, useProductSearch, Product } from "@/features/products";

const Shop = () => {
  const [searchParams] = useSearchParams();
  const [showReferralModal, setShowReferralModal] = useState(false);
  const { addToCart } = useCart();
  const { refreshSubscription } = useAuth();
  const { toast } = useToast();

  const { products, isLoading, farmerData, consumerProfile, marketConfig } = useShopProducts();
  const { searchQuery, setSearchQuery, filteredProducts } = useProductSearch(products);

  useEffect(() => {
    const subscriptionParam = searchParams.get('subscription');
    if (subscriptionParam === 'success') {
      toast({
        title: "Subscription Active!",
        description: "Your monthly subscription is now active. Start earning credits!",
      });
      refreshSubscription();
    } else if (subscriptionParam === 'cancelled') {
      toast({
        title: "Subscription Cancelled",
        description: "You can subscribe anytime from your profile.",
        variant: "destructive",
      });
    }
  }, [searchParams, refreshSubscription, toast]);

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart.mutate({
      productId: product.id,
      quantity: quantity,
      unitPrice: product.price,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-earth pb-20 md:pb-8">
      <ShopHeader 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        marketConfig={marketConfig}
      />

      <main className="container mx-auto px-4 py-8">
        <ReferralBanner onOpenModal={() => setShowReferralModal(true)} />
        
        <InfoBanner />

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Farm Fresh Produce</h2>
          <p className="text-muted-foreground">
            90% of your purchase goes directly to the farmer
          </p>
        </div>

        <ProductGrid
          products={filteredProducts}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onAddToCart={handleAddToCart}
          farmerData={farmerData}
          consumerProfile={consumerProfile}
        />
      </main>

      <ReferralModal open={showReferralModal} onOpenChange={setShowReferralModal} />
    </div>
  );
};

export default Shop;
