import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/formatMoney";
import { PriceBreakdownDrawer } from "@/components/PriceBreakdownDrawer";
import { Calendar, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateFarmToConsumerDistance } from "@/lib/distanceHelpers";

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

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get consumer's zip code for distance calculation
  const { data: profile } = useQuery({
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
  });

  // Calculate distance from farm
  const milesFromFarm = product.farm_profiles.location && profile?.zip_code
    ? calculateFarmToConsumerDistance(product.farm_profiles.location, profile.zip_code)
    : null;

  return (
    <Card className="overflow-hidden hover:shadow-large transition-shadow">
      <div className="bg-gradient-hero p-8 text-center">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover rounded" />
        ) : (
          <div className="text-6xl mb-2">🌱</div>
        )}
      </div>
      
      <div className="p-6 space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-foreground">{product.name}</h3>
          <button
            onClick={() => navigate(`/farm/${product.farm_profile_id}`)}
            className="text-sm text-primary hover:underline cursor-pointer"
          >
            {product.farm_profiles.farm_name}
          </button>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
          )}
          
          {/* Trust signals */}
          <div className="flex flex-wrap gap-2 mt-2">
            {product.harvest_date && (
              <Badge variant="secondary" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Picked {formatDistanceToNow(new Date(product.harvest_date), { addSuffix: true })}
              </Badge>
            )}
            
            {milesFromFarm && (
              <Badge variant="outline" className="text-xs">
                <MapPin className="h-3 w-3 mr-1" />
                {milesFromFarm} mi away
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-foreground">
              {formatMoney(product.price)}
              <span className="text-sm font-normal text-muted-foreground">/{product.unit}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {product.available_quantity} available
            </div>
            <PriceBreakdownDrawer 
              price={product.price} 
              farmName={product.farm_profiles.farm_name}
            />
          </div>

          <Button onClick={() => onAddToCart(product)}>
            Add to Cart
          </Button>
        </div>
      </div>
    </Card>
  );
};
