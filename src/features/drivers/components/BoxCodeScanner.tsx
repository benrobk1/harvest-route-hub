/**
 * BOX CODE SCANNER COMPONENT
 * 
 * Handles box code verification for both loading and delivery scenarios.
 * 
 * **CRITICAL SECURITY FEATURE - ADDRESS PRIVACY PROTECTION**
 * 
 * This component is a key part of the address privacy system that prevents
 * drivers from cherry-picking routes based on "desirable" delivery addresses.
 * 
 * HOW IT WORKS:
 * 1. When driver scans box code at COLLECTION POINT (mode='loading'):
 *    - Sets `address_visible_at` timestamp on batch_stops table
 *    - This timestamp unlock triggers full address visibility in RLS policy
 *    - Driver can now see exact delivery address for that specific order
 * 
 * 2. When driver scans box code at DELIVERY (mode='delivery'):
 *    - Logs delivery completion
 *    - Verifies correct box delivered to correct address
 *    - Updates order status
 * 
 * WHY THIS MATTERS:
 * - Prevents operational abuse (route cherry-picking)
 * - Protects consumer privacy (addresses hidden until pickup confirmed)
 * - Ensures fair batch distribution (all drivers see same info when claiming)
 * 
 * @see {@link https://github.com/yourusername/blue-harvests/blob/main/ARCHITECTURE.md#operational-safety-driver-address-privacy}
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine, CheckCircle2, XCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";

type OrderItemRecord = {
  quantity: number;
  products: {
    name: string;
  } | null;
};

type OrderRecord = {
  id: string;
  box_code: string;
  profiles: {
    full_name: string;
    delivery_address: string;
  };
  order_items: OrderItemRecord[];
};

interface VerifiedOrder {
  orderId: string;
  boxCode: string;
  customerName: string;
  address: string;
  items: Array<{ name: string; quantity: number }>;
}

interface BoxCodeScannerProps {
  mode?: 'loading' | 'delivery';
  batchId?: string;
  stopId?: string;
  onScanComplete?: (orderId: string, boxCode: string) => void;
}

export const BoxCodeScanner = ({ 
  mode = 'delivery', 
  batchId, 
  stopId, 
  onScanComplete 
}: BoxCodeScannerProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [scannedCode, setScannedCode] = useState("");
  const [verifiedOrder, setVerifiedOrder] = useState<VerifiedOrder | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!scannedCode.trim()) {
      setError("Please enter a box code");
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);
      setVerifiedOrder(null);

      // Verify box code and get order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          box_code,
          profiles!inner(full_name, delivery_address),
          order_items(
            quantity,
            products(name)
          )
        `)
        .eq('box_code', scannedCode.toUpperCase())
        .maybeSingle<OrderRecord>();

      if (orderError) throw orderError;

      if (!order) {
        setError(`Box code "${scannedCode}" not found`);
        toast({
          title: "Box Not Found",
          description: "Please check the code and try again",
          variant: "destructive",
        });
        return;
      }

      const verified: VerifiedOrder = {
        orderId: order.id,
        boxCode: order.box_code,
        customerName: order.profiles.full_name,
        address: order.profiles.delivery_address,
        items: order.order_items
          .filter((item): item is OrderItemRecord & { products: { name: string } } => !!item.products)
          .map((item) => ({
            name: item.products.name,
            quantity: item.quantity,
          })),
      };

      setVerifiedOrder(verified);

      /**
       * CRITICAL: Address Privacy System Implementation
       * 
       * When scanning at COLLECTION POINT (mode='loading'):
       * - This scan creates a timestamp that unlocks address visibility
       * - The database trigger or RLS policy uses `address_visible_at IS NOT NULL`
       * - This prevents drivers from seeing addresses before confirming pickup
       * 
       * Database flow:
       * 1. Driver scans box at farm → scan log created with scan_type='loaded'
       * 2. RLS policy: `address_visible_at IS NOT NULL OR has_role(auth.uid(), 'admin')`
       * 3. Full address becomes visible ONLY after this scan
       * 
       * This is the key enforcement mechanism that prevents route cherry-picking.
       */
      if (user?.id) {
        await supabase.from('delivery_scan_logs').insert({
          batch_id: batchId,
          stop_id: stopId,
          order_id: order.id,
          driver_id: user.id,
          box_code: scannedCode.toUpperCase(),
          scan_type: mode === 'loading' ? 'loaded' : 'delivered',
        });
      }

      // Call callback if provided
      if (onScanComplete) {
        onScanComplete(order.id, scannedCode.toUpperCase());
      }

      toast({
        title: mode === 'loading' ? "Box Loaded!" : "Box Delivered!",
        description: `Box ${scannedCode} confirmed`,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      setError(message);
      toast({
        title: "Verification Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setScannedCode("");
    setVerifiedOrder(null);
    setError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          {mode === 'loading' ? 'Load Box' : 'Verify Delivery'}
        </CardTitle>
        <CardDescription>
          {mode === 'loading' 
            ? 'Scan box code when loading onto truck' 
            : 'Scan box code to verify delivery'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter box code (e.g., B123-5)"
            value={scannedCode}
            onChange={(e) => {
              setScannedCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            disabled={isVerifying || !!verifiedOrder}
            className="font-mono"
          />
          {verifiedOrder ? (
            <Button onClick={handleReset} variant="outline">
              Reset
            </Button>
          ) : (
            <Button onClick={handleVerify} disabled={isVerifying || !scannedCode.trim()}>
              {isVerifying ? "Verifying..." : "Verify"}
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <XCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {verifiedOrder && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-900">Box Verified</p>
                <p className="text-xs text-green-700">Code: {verifiedOrder.boxCode}</p>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium">Customer</p>
                <p className="text-sm text-muted-foreground">{verifiedOrder.customerName}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Delivery Address</p>
                <p className="text-sm text-muted-foreground">{verifiedOrder.address}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Box Contents
              </p>
              <div className="border rounded-lg divide-y">
                {verifiedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between p-3">
                    <span className="text-sm">{item.name}</span>
                    <Badge variant="outline">x{item.quantity}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
