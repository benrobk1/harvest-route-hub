import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sprout, Info } from 'lucide-react';
import { formatMoney } from '@/lib/formatMoney';
import { calculateRevenueSplit } from '@/lib/deliveryFeeHelpers';

interface PriceBreakdownDrawerProps {
  price: number;
  farmName: string;
  isCheckout?: boolean;
}

export const PriceBreakdownDrawer = ({ 
  price, 
  farmName,
  isCheckout = false 
}: PriceBreakdownDrawerProps) => {
  // REVENUE MODEL: 90/5/5 split ensures fair farmer compensation
  // - 90% to farmer (significantly higher than traditional grocery ~40-50%)
  // - 5% platform fee (covers operations, support, infrastructure)
  // - 5% delivery fee (covers driver payouts, route optimization)
  // This model is transparent to consumers and shown in UI to build trust
  const { farmerShare, platformFee, deliveryFee } = calculateRevenueSplit(price);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="link" className="text-xs p-0 h-auto">
          See price breakdown
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Where your money goes</DrawerTitle>
          <DrawerDescription>
            Transparent pricing that supports local farmers
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 space-y-4 max-w-md mx-auto w-full">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total</span>
              <span>{formatMoney(price)}</span>
            </div>
            <Separator />
            
            <div className="flex justify-between items-center py-2 bg-earth/10 px-3 rounded-lg">
              <span className="flex items-center gap-2 font-medium">
                <Sprout className="h-4 w-4 text-earth" />
                {farmName} gets
              </span>
              <span className="font-bold text-earth">
                {formatMoney(farmerShare)} <span className="text-xs font-normal">(90%)</span>
              </span>
            </div>
            
            <div className="flex justify-between items-center text-sm px-3">
              <span className="text-muted-foreground">Platform fee</span>
              <span>{formatMoney(platformFee)} (5%)</span>
            </div>
            
            <div className="flex justify-between items-center text-sm px-3">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>{formatMoney(deliveryFee)} (5%)</span>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Compare to grocery stores: farmers typically get 10-15% of retail price
            </AlertDescription>
          </Alert>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
