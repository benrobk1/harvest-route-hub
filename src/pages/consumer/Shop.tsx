import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, MapPin, Package, User, TrendingUp, Clock } from "lucide-react";
import logo from "@/assets/blue-harvests-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import ProductCard from "@/components/ProductCard";
import ProductCardSkeleton from "@/components/ProductCardSkeleton";
import { CartDrawer } from "@/components/CartDrawer";
import { ReferralBanner } from "@/components/consumer/ReferralBanner";
import { ReferralModal } from "@/components/consumer/ReferralModal";
import { SpendingProgressCard } from "@/components/consumer/SpendingProgressCard";
import { formatMoney } from "@/lib/formatMoney";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { isCutoffPassed, getNextAvailableDate } from "@/lib/marketHelpers";
import { preloadImage } from "@/lib/imageHelpers";

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

const Shop = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [searchParams] = useSearchParams();
  const [showReferralModal, setShowReferralModal] = useState(false);
  const { addToCart } = useCart();
  const { subscriptionStatus, refreshSubscription, user } = useAuth();
  const { toast } = useToast();

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

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          farm_profiles!inner (
            id,
            farm_name,
            location
          )
        `)
        .gt("available_quantity", 0)
        .eq("approved", true);

      if (error) throw error;
      return data as Product[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch all farmer data for products in one query (prevents N+1 problem)
  const farmProfileIds = useMemo(() => 
    [...new Set(products.map(p => p.farm_profile_id))],
    [products]
  );

  const { data: farmerData } = useQuery({
    queryKey: ['farmers-batch', farmProfileIds],
    queryFn: async () => {
      if (farmProfileIds.length === 0) return {};
      
      const { data } = await supabase
        .from('farm_profiles')
        .select(`
          id,
          farmer_id,
          profiles!farm_profiles_farmer_id_fkey (
            avatar_url,
            full_name
          )
        `)
        .in('id', farmProfileIds);
      
      // Create a map for easy lookup
      const map: Record<string, any> = {};
      data?.forEach(farm => {
        map[farm.id] = farm;
      });
      return map;
    },
    enabled: farmProfileIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Get consumer's profile for distance calculation
  const { data: consumerProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('zip_code')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const { data: marketConfig } = useQuery({
    queryKey: ['market-config-shop'],
    queryFn: async () => {
      const { data } = await supabase
        .from('market_configs')
        .select('*')
        .eq('zip_code', '10001')
        .eq('active', true)
        .maybeSingle();
      return data;
    },
  });

  const filteredProducts = useMemo(
    () => products.filter((product) =>
      product.name.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      product.farm_profiles.farm_name.toLowerCase().includes(deferredSearch.toLowerCase())
    ),
    [products, deferredSearch]
  );

  // Preload first 3 product images for faster perceived load
  useEffect(() => {
    filteredProducts.slice(0, 3).forEach(p => {
      if (p.image_url) preloadImage(p.image_url).catch(() => {});
    });
  }, [filteredProducts]);

  const handleAddToCart = (product: Product) => {
    addToCart.mutate({
      productId: product.id,
      quantity: 1,
      unitPrice: product.price,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-earth pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src={logo} alt="Blue Harvests" className="h-12 object-contain" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Blue Harvests</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>Delivering to ZIP 10001</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/consumer/profile")}>
                <User className="h-5 w-5 mr-2" />
                Profile
              </Button>
              <Button variant="outline" onClick={() => navigate("/consumer/orders")}>
                <Package className="h-5 w-5 mr-2" />
                Orders
              </Button>
              <CartDrawer />
            </div>
          </div>
          
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for produce..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Spending Progress Card */}
          <div className="mt-4">
            <SpendingProgressCard />
          </div>

          {/* Cutoff Alert */}
          {marketConfig && (
            <Alert className="mt-4">
              <Clock className="h-4 w-4" />
              <AlertTitle>Order Deadline</AlertTitle>
              <AlertDescription>
                {(() => {
                  const isPastCutoff = isCutoffPassed(marketConfig.cutoff_time || '23:59:00');
                  const cutoffDisplay = marketConfig.cutoff_time?.slice(0, 5) || '11:59 PM';
                  const nextDeliveryDate = getNextAvailableDate(
                    marketConfig.cutoff_time || '23:59:00',
                    marketConfig.delivery_days || []
                  );
                  const deliveryDateStr = nextDeliveryDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  });

                  if (isPastCutoff) {
                    return (
                      <>
                        Orders placed now will be delivered on <strong>{deliveryDateStr}</strong>.
                        <br />
                        <span className="text-xs text-muted-foreground">
                          (Cutoff for earlier delivery was {cutoffDisplay})
                        </span>
                      </>
                    );
                  } else {
                    return (
                      <>
                        Order by <strong>{cutoffDisplay}</strong> for delivery on <strong>{deliveryDateStr}</strong>.
                        <br />
                        <span className="text-xs text-green-600">✓ Currently accepting orders!</span>
                      </>
                    );
                  }
                })()}
              </AlertDescription>
            </Alert>
          )}

          {/* 
            SECURITY: RLS Trust Badge
            Displays Row-Level Security enforcement to build consumer confidence.
            Shows that drivers only see addresses when delivery is near (just-in-time access).
            Part of P2 security hardening (transparency for users).
          */}
          <Alert className="mt-4 bg-primary/5 border-primary/20">
            <AlertTitle className="flex items-center gap-2 text-primary">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Your Data is Protected
            </AlertTitle>
            <AlertDescription>
              Row-level security enforced • Drivers see addresses only when delivery is near
            </AlertDescription>
          </Alert>
        </div>
      </header>

      {/* Products */}
      <main className="container mx-auto px-4 py-8">
        {/* Referral Banner */}
        <ReferralBanner onOpenModal={() => setShowReferralModal(true)} />

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Farm Fresh Produce</h2>
          <p className="text-muted-foreground">
            90% of your purchase goes directly to the farmer
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? 'No products match your search.' : 'No products available at the moment. Check back soon!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                farmerData={farmerData?.[product.farm_profile_id]}
                consumerProfile={consumerProfile}
              />
            ))}
          </div>
        )}

        {/* Info Banner */}
        <Card className="mt-8 bg-primary text-primary-foreground p-6">
          <div className="grid gap-4 md:grid-cols-3 text-center">
            <div>
              <div className="text-2xl font-bold mb-1">{formatMoney(25)}</div>
              <div className="text-sm opacity-90">Minimum Order</div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">{formatMoney(7.50)}</div>
              <div className="text-sm opacity-90">Delivery Fee (100% to Driver)</div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">{formatMoney(10)}</div>
              <div className="text-sm opacity-90">Credit for $100+ Monthly Spend</div>
            </div>
          </div>
        </Card>
      </main>

      {/* Referral Modal */}
      <ReferralModal open={showReferralModal} onOpenChange={setShowReferralModal} />
    </div>
  );
};

export default Shop;
