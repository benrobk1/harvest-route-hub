import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Minus, Plus, Trash2, Save, History } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useCart } from "../hooks/useCart";
import { SaveCartDialog } from "./SaveCartDialog";
import { SavedCartsList } from "./SavedCartsList";
import CartItemSkeleton from "./CartItemSkeleton";

export const CartDrawer = () => {
  const {
    cart,
    cartCount, 
    cartTotal, 
    updateQuantity, 
    removeItem, 
    isLoading,
    savedCarts = [], 
    saveCart, 
    loadSavedCart, 
    deleteSavedCart
  } = useCart();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
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
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
        </SheetHeader>
        
        <Tabs defaultValue="cart" className="flex-1 flex flex-col pt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cart">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Cart ({cartCount})
            </TabsTrigger>
            <TabsTrigger value="saved">
              <History className="h-4 w-4 mr-2" />
              Saved ({savedCarts.length})
            </TabsTrigger>
          </TabsList>

          {/* Current Cart Tab */}
          <TabsContent value="cart" className="flex-1 flex flex-col mt-4">
            {isLoading ? (
              <div className="flex-1 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <CartItemSkeleton key={i} />
                ))}
              </div>
            ) : !cart?.items || cart.items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-muted-foreground">Your cart is empty</p>
                </div>
              </div>
            ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.products.name}</h4>
                      <button
                        onClick={() => navigate(`/farm/${item.products.farm_profiles.id}`)}
                        className="text-sm text-primary hover:underline"
                      >
                        {item.products.farm_profiles.farm_name}
                      </button>
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
              
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>{formatMoney(cartTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setShowSaveDialog(true)}
                    disabled={!cart?.items || cart.items.length === 0}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Cart
                  </Button>
                  <Button asChild disabled={cartTotal < 25}>
                    <Link to="/consumer/checkout" onClick={() => setOpen(false)}>
                      {cartTotal < 25 ? `$${(25 - cartTotal).toFixed(2)} more` : 'Checkout'}
                    </Link>
                  </Button>
                </div>
                {cartTotal < 25 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Minimum order: {formatMoney(25)}
                  </p>
                )}
              </div>
            </>
            )}
          </TabsContent>

          {/* Saved Carts Tab */}
          <TabsContent value="saved" className="flex-1 overflow-y-auto mt-4">
            <SavedCartsList
              savedCarts={savedCarts}
              onLoad={(cartId) => loadSavedCart.mutate(cartId)}
              onDelete={(cartId) => deleteSavedCart.mutate(cartId)}
              isLoading={loadSavedCart.isPending || deleteSavedCart.isPending}
            />
          </TabsContent>
        </Tabs>

        <SaveCartDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          onSave={(name) => {
            saveCart.mutate(name);
            setShowSaveDialog(false);
          }}
          isSaving={saveCart.isPending}
        />
      </SheetContent>
    </Sheet>
  );
};
