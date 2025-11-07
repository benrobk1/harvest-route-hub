import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatMoney } from '@/lib/formatMoney';
import { Calendar, MapPin, Sprout, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import PriceBreakdownDrawer from './PriceBreakdownDrawer';
import { LoadingButton } from './LoadingButton';
import { calculateFarmToConsumerDistance } from '@/lib/distanceHelpers';
import { FarmStoryModal } from './FarmStoryModal';
import { useCartActions } from '@/features/cart';
import { QuantitySelector } from '@/features/consumers';

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
  onAddToCart: (product: Product, quantity: number) => void;
  farmerData?: {
    profiles?: {
      avatar_url?: string;
      full_name?: string;
    };
  };
  consumerProfile?: {
    zip_code?: string;
  } | null;
}

const ProductCard = ({ product, onAddToCart, farmerData, consumerProfile }: ProductCardProps) => {
  const navigate = useNavigate();
  const [showFarmStory, setShowFarmStory] = useState(false);
  
  const {
    isAdding,
    justAdded,
    quantity,
    handleAddToCart: handleCartAction,
    incrementQuantity,
    decrementQuantity,
  } = useCartActions();

  const milesFromFarm = useMemo(() => {
    if (!product.farm_profiles.location || !consumerProfile?.zip_code) return null;
    return calculateFarmToConsumerDistance(product.farm_profiles.location, consumerProfile.zip_code);
  }, [product.farm_profiles.location, consumerProfile?.zip_code]);

  const handleAddToCart = () => {
    handleCartAction(async () => {
      await onAddToCart(product, quantity);
    });
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-200">
      {product.image_url && (
        <img 
          src={product.image_url} 
          alt={`${product.name} from ${product.farm_profiles.farm_name}`}
          className="w-full aspect-video object-cover" 
          loading="lazy"
          decoding="async"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      )}
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Avatar className="h-6 w-6">
              <AvatarImage src={farmerData?.profiles?.avatar_url || ''} />
              <AvatarFallback>
                <Sprout className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => navigate(`/farm/${product.farm_profile_id}`)}
              className="text-sm text-primary hover:underline"
            >
              {product.farm_profiles.farm_name}
            </button>
          </div>
        </div>

        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {product.harvest_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(product.harvest_date), 'MMM d')}
            </div>
          )}
          {milesFromFarm && (
            <>
              {product.harvest_date && <span>•</span>}
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {milesFromFarm} mi
              </div>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFarmStory(true)}
          className="text-xs h-7 px-2"
        >
          Farm Story →
        </Button>

        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <div className="text-xl font-bold">
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

          <div className="flex flex-col gap-2">
            <QuantitySelector
              quantity={quantity}
              onIncrement={() => incrementQuantity(product.available_quantity)}
              onDecrement={decrementQuantity}
              disabled={isAdding || justAdded}
            />
            
            {/* Add to Cart Button */}
            <LoadingButton 
              onClick={handleAddToCart}
              isLoading={isAdding}
              loadingText="Adding..."
              disabled={justAdded}
              size="sm"
            >
              {justAdded ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Added!
                </>
              ) : (
                'Add to Cart'
              )}
            </LoadingButton>
          </div>
        </div>
      </CardContent>

      <FarmStoryModal
        farmProfileId={product.farm_profile_id}
        open={showFarmStory}
        onOpenChange={setShowFarmStory}
      />
    </Card>
  );
};

export default React.memo(ProductCard);
