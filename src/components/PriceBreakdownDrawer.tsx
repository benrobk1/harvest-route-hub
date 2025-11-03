import React from 'react';
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

const PriceBreakdownDrawer = ({ 
  price, 
  farmName,
  isCheckout = false 
}: PriceBreakdownDrawerProps) => {
  // REVENUE MODEL: 88/2/10 split (product price only)
  // - 88% to farmer (significantly higher than traditional grocery ~10-15%)
  // - 2% to lead farmer (coordination fee)
  // - 10% platform fee (operations, support, infrastructure)
  // Note: Delivery fee ($7.50) is separate and goes 100% to driver
  const farmerShare = price * 0.88;
  const leadFarmerShare = price * 0.02;
  const platformFee = price * 0.10;

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
              <span>Product Price</span>
              <span>{formatMoney(price)}</span>
            </div>
            <Separator />
            
            {/* Farmer Share - 88% */}
            <div className="flex justify-between items-center py-2 bg-earth/10 px-3 rounded-lg">
              <span className="flex items-center gap-2 font-medium">
                <Sprout className="h-4 w-4 text-earth" />
                {farmName} gets
              </span>
              <span className="font-bold text-earth">
                {formatMoney(farmerShare)} <span className="text-xs font-normal">(88%)</span>
              </span>
            </div>
            
            {/* Lead Farmer Commission - 2% */}
            <div className="flex justify-between items-center text-sm px-3">
              <span className="text-muted-foreground">Lead farmer coordination</span>
              <span>{formatMoney(leadFarmerShare)} (2%)</span>
            </div>
            
            {/* Platform Fee - 10% */}
            <div className="flex justify-between items-center text-sm px-3">
              <span className="text-muted-foreground">Platform fee</span>
              <span>{formatMoney(platformFee)} (10%)</span>
            </div>
            
            <Separator />
            
            {/* Total */}
            <div className="flex justify-between items-center text-lg font-bold pt-2">
              <span>Total</span>
              <span>{formatMoney(price)}</span>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Farmers receive 90% of product price (vs 10-15% at grocery stores).
            </AlertDescription>
          </Alert>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default React.memo(PriceBreakdownDrawer);
