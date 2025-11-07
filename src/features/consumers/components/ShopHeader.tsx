import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, MapPin, Package, User, Clock, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/blue-harvests-logo.jpeg';
import { SpendingProgressCard } from './SpendingProgressCard';
import { CartDrawer } from '@/features/cart';
import { isCutoffPassed, getNextAvailableDate } from '@/lib/marketHelpers';

interface ShopHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  marketConfig?: {
    cutoff_time: string | null;
    delivery_days: string[] | null;
  } | null;
}

export const ShopHeader = ({ searchQuery, onSearchChange, marketConfig }: ShopHeaderProps) => {
  const navigate = useNavigate();

  return (
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
            <Button variant="outline" onClick={() => navigate("/consumer/live-tracking")}>
              <Truck className="h-5 w-5 mr-2" />
              Live Status
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
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <SpendingProgressCard />
        </div>

        {marketConfig && (
          <Alert className="mt-4">
            <Clock className="h-4 w-4" />
            <AlertTitle>Order Deadline</AlertTitle>
            <AlertDescription>
              {(() => {
                const isPastCutoff = isCutoffPassed(marketConfig.cutoff_time || '23:59:00');
                const cutoffDisplay = marketConfig.cutoff_time?.slice(0, 5) || '11:59 PM';
                const nextDeliveryDate = getNextAvailableDate(
                  marketConfig.cutoff_time || '23:59:00',
                  marketConfig.delivery_days || []
                );
                const deliveryDateStr = nextDeliveryDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                });

                if (isPastCutoff) {
                  return (
                    <>
                      Orders placed now will be delivered on <strong>{deliveryDateStr}</strong>.
                      <br />
                      <span className="text-xs text-muted-foreground">
                        (Cutoff for earlier delivery was {cutoffDisplay})
                      </span>
                    </>
                  );
                } else {
                  return (
                    <>
                      Order by <strong>{cutoffDisplay}</strong> for delivery on <strong>{deliveryDateStr}</strong>.
                      <br />
                      <span className="text-xs text-green-600">✓ Currently accepting orders!</span>
                    </>
                  );
                }
              })()}
            </AlertDescription>
          </Alert>
        )}

        <Alert className="mt-4 bg-primary/5 border-primary/20">
          <AlertTitle className="flex items-center gap-2 text-primary">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Your Data is Protected
          </AlertTitle>
          <AlertDescription>
            Row-level security enforced • Drivers see addresses only when delivery is near
          </AlertDescription>
        </Alert>
      </div>
    </header>
  );
};
