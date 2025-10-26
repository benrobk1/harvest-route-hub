import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { formatMoney } from "@/lib/formatMoney";
import { useNavigate } from "react-router-dom";

export const CartDrawer = () => {
  const { cart, cartCount, cartTotal, updateQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="relative">
          <ShoppingCart className="h-5 w-5 mr-2" />
          Cart
          {cartCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
              {cartCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
        </SheetHeader>
        
        <div className="flex flex-col h-full pt-6">
          {!cart?.items || cart.items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.products.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {item.products.farm_profiles.farm_name}
                      </p>
                      <p className="text-sm font-medium mt-1">
                        {formatMoney(Number(item.unit_price))} / {item.products.unit}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                          disabled={item.quantity >= item.products.available_quantity}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem.mutate(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4 space-y-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatMoney(cartTotal)}</span>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate('/consumer/checkout')}
                  disabled={cartTotal < 25}
                >
                  {cartTotal < 25 ? `$${(25 - cartTotal).toFixed(2)} more for minimum` : 'Checkout'}
                </Button>
                {cartTotal < 25 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Minimum order: {formatMoney(25)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
