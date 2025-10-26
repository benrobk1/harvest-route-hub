import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/formatMoney";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  available_quantity: number;
  image_url: string | null;
  farm_profile_id: string;
  farm_profiles: {
    id: string;
    farm_name: string;
  };
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const ProductCard = ({ product, onAddToCart }: ProductCardProps) => {
  const navigate = useNavigate();

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
          </div>

          <Button onClick={() => onAddToCart(product)}>
            Add to Cart
          </Button>
        </div>
      </div>
    </Card>
  );
};
