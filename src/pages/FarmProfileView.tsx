import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FarmProfile {
  id: string;
  farm_name: string;
  description: string;
  bio: string;
  location: string;
  farmer_id: string;
}

interface FarmPhoto {
  id: string;
  photo_url: string;
  display_order: number;
}

interface ImpactMetrics {
  totalSales: number;
  totalOrders: number;
  familiesFed: number;
}

const FarmProfileView = () => {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [photos, setPhotos] = useState<FarmPhoto[]>([]);
  const [metrics, setMetrics] = useState<ImpactMetrics>({ totalSales: 0, totalOrders: 0, familiesFed: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const loadFarmProfile = useCallback(async () => {
    if (!farmId) return;

    // Load farm profile
    const { data: farmData, error: farmError } = await supabase
      .from("farm_profiles")
      .select("*")
      .eq("id", farmId)
      .single();

    if (farmError) {
      console.error("Error loading farm profile:", farmError);
      setIsLoading(false);
      return;
    }

    setFarm(farmData);

    // Load farm photos
    const { data: photosData } = await supabase
      .from("farm_photos")
      .select("*")
      .eq("farm_profile_id", farmId)
      .order("display_order");

    if (photosData) {
      setPhotos(photosData);
    }

    // Calculate impact metrics
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .eq("farm_profile_id", farmId);

    if (products && products.length > 0) {
      const productIds = products.map(p => p.id);
      
      // Get order items for these products
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          subtotal,
          order_id,
          orders!inner(status)
        `)
        .in("product_id", productIds)
        .eq("orders.status", "delivered");

      if (orderItems) {
        // Calculate from payouts instead of order_items for accurate farmer revenue
        const { data: farmerPayouts } = await supabase
          .from('payouts')
          .select('amount, order_id')
          .eq('recipient_type', 'farmer')
          .in('order_id', Array.from(new Set(orderItems.map(item => item.order_id))));

        const totalSales = farmerPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const uniqueOrders = new Set(orderItems.map(item => item.order_id));
        const totalOrders = uniqueOrders.size;
        // Estimate meals served: 1,895 meals / 1,025 orders ≈ 1.85 meals per order
        const familiesFed = Math.floor(totalOrders * 1.85);

        setMetrics({ totalSales, totalOrders, familiesFed });
      }
    }

    setIsLoading(false);
  }, [farmId]);

  useEffect(() => {
    loadFarmProfile();
  }, [loadFarmProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center">
        <div className="text-center">
          <Sprout className="h-12 w-12 text-earth mx-auto mb-4 animate-pulse" />
          <p>Loading farm profile...</p>
        </div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">Farm profile not found</p>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-earth">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="border-2 shadow-large">
          <CardHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-earth/10 flex items-center justify-center flex-shrink-0">
                <Sprout className="h-8 w-8 text-earth" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{farm.farm_name}</CardTitle>
                {farm.location && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {farm.location}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Impact Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="text-center p-4">
                <p className="text-2xl font-bold text-earth">${metrics.totalSales.toFixed(0)}</p>
                <p className="text-sm text-muted-foreground">Total Sales</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-2xl font-bold text-earth">{metrics.totalOrders}</p>
                <p className="text-sm text-muted-foreground">Orders Delivered</p>
              </Card>
              <Card className="text-center p-4">
                <p className="text-2xl font-bold text-earth">{metrics.familiesFed}</p>
                <p className="text-sm text-muted-foreground">Meals Served</p>
              </Card>
            </div>

            {farm.bio && (
              <div>
                <h3 className="text-lg font-semibold mb-2">Our Story</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {farm.bio}
                </p>
              </div>
            )}

            {farm.description && (
              <div>
                <h3 className="text-lg font-semibold mb-2">About This Farm</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {farm.description}
                </p>
              </div>
            )}

            {/* Photo Gallery */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Farm Photos</h3>
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="aspect-square rounded-lg overflow-hidden border-2">
                      <img
                        src={photo.photo_url}
                        alt="Farm photo"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No photos yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmProfileView;
