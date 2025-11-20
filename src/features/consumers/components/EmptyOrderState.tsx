import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const EmptyOrderState = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Active Delivery</h2>
        <p className="text-muted-foreground mb-6">
          You don't have orders currently being delivered.
        </p>
        <div className="space-y-3">
          <Button onClick={() => navigate('/consumer/shop')} className="w-full max-w-xs">
            Shop Now
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/consumer/orders')}
            className="w-full max-w-xs"
          >
            View Order History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
