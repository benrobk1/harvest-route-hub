import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, TrendingDown, TrendingUp, MapPin } from "lucide-react";

const Shop = () => {
  const [cart, setCart] = useState<any[]>([]);

  const products = [
    {
      id: 1,
      name: "Organic Tomatoes",
      farm: "Green Valley Farm",
      price: 4.99,
      marketPrice: 6.99,
      freshness: "Picked 2 days ago",
      image: "🍅",
      unit: "lb",
    },
    {
      id: 2,
      name: "Fresh Lettuce",
      farm: "Sunny Acres",
      price: 3.49,
      marketPrice: 4.99,
      freshness: "Picked yesterday",
      image: "🥬",
      unit: "head",
    },
    {
      id: 3,
      name: "Sweet Corn",
      farm: "Harvest Hills",
      price: 5.99,
      marketPrice: 4.99,
      freshness: "Picked 3 days ago",
      image: "🌽",
      unit: "dozen",
    },
  ];

  const addToCart = (product: any) => {
    setCart([...cart, product]);
  };

  return (
    <div className="min-h-screen bg-gradient-earth">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Blue Harvests</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Delivering to ZIP 10001</span>
              </div>
            </div>
            <Button className="relative">
              <ShoppingCart className="h-5 w-5 mr-2" />
              Cart
              {cart.length > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                  {cart.length}
                </Badge>
              )}
            </Button>
          </div>
          
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for produce..."
              className="pl-10"
            />
          </div>
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const priceDiff = product.price - product.marketPrice;
            const isBelow = priceDiff < 0;

            return (
              <Card key={product.id} className="overflow-hidden hover:shadow-large transition-shadow">
                <div className="bg-gradient-hero p-8 text-center">
                  <div className="text-6xl mb-2">{product.image}</div>
                  <Badge variant="secondary" className="bg-white/90">
                    {product.freshness}
                  </Badge>
                </div>
                
                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.farm}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-foreground">
                        ${product.price}
                        <span className="text-sm font-normal text-muted-foreground">/{product.unit}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {isBelow ? (
                          <>
                            <TrendingDown className="h-3 w-3 text-success" />
                            <span className="text-success">
                              ${Math.abs(priceDiff).toFixed(2)} below market
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="h-3 w-3 text-destructive" />
                            <span className="text-destructive">
                              ${priceDiff.toFixed(2)} above market
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Button onClick={() => addToCart(product)}>
                      Add to Cart
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Info Banner */}
        <Card className="mt-8 bg-primary text-primary-foreground p-6">
          <div className="grid gap-4 md:grid-cols-3 text-center">
            <div>
              <div className="text-2xl font-bold mb-1">$25</div>
              <div className="text-sm opacity-90">Minimum Order</div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">$7.50</div>
              <div className="text-sm opacity-90">Delivery Fee (100% to Driver)</div>
            </div>
            <div>
              <div className="text-2xl font-bold mb-1">$10</div>
              <div className="text-sm opacity-90">Credit for $100+ Monthly Spend</div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Shop;
