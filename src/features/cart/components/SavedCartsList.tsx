import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingCart } from 'lucide-react';
import { formatMoney } from '@/lib/formatMoney';
import { format } from 'date-fns';
import type { SavedCart } from '../types';

interface SavedCartsListProps {
  savedCarts: SavedCart[];
  onLoad: (cartId: string) => void;
  onDelete: (cartId: string) => void;
  isLoading: boolean;
}

export const SavedCartsList = ({ savedCarts, onLoad, onDelete, isLoading }: SavedCartsListProps) => {
  if (savedCarts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No saved carts yet</p>
        <p className="text-sm">Save your cart to easily reorder later</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {savedCarts.map((cart) => {
        const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const total = cart.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

        return (
          <Card key={cart.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate">{cart.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} • {formatMoney(total)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Saved {format(new Date(cart.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onLoad(cart.id)}
                  disabled={isLoading}
                >
                  Load
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(cart.id)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
