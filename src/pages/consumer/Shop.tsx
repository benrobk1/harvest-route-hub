import { useState, useEffect } from "react";
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
import { ProductCard } from "@/components/ProductCard";
import { CartDrawer } from "@/components/CartDrawer";
import { formatMoney } from "@/lib/formatMoney";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { isCutoffPassed } from "@/lib/marketHelpers";

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
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { subscriptionStatus, refreshSubscription } = useAuth();
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
        .gt("available_quantity", 0);

      if (error) throw error;
      return data as Product[];
    },
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

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.farm_profiles.farm_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

          {/* Subscription Progress Banner */}
          {subscriptionStatus?.subscribed && (
            <Card className="mt-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Progress to $10 Credit</span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">
                      {formatMoney(subscriptionStatus.credits_available)}
                    </div>
                    <div className="text-xs text-muted-foreground">Available Credits</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Progress value={subscriptionStatus.progress_to_credit} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatMoney(subscriptionStatus.monthly_spend)} spent this month</span>
                    <span>{formatMoney(Math.max(0, 100 - subscriptionStatus.monthly_spend))} to next credit</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Cutoff Alert */}
          {marketConfig && (
            <Alert className="mt-4">
              <Clock className="h-4 w-4" />
              <AlertTitle>Order Deadline</AlertTitle>
              <AlertDescription>
                Orders for next-day delivery must be placed by {marketConfig.cutoff_time?.slice(0, 5) || '11:59 PM'}.
                {isCutoffPassed(marketConfig.cutoff_time || '23:59:00') ? ' Currently closed - orders will be for the day after tomorrow.' : ' Currently accepting orders!'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </header>

      {/* Products */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Farm Fresh Produce</h2>
          <p className="text-muted-foreground">
            90% of your purchase goes directly to the farmer
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading fresh produce...</p>
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
    </div>
  );
};

export default Shop;
