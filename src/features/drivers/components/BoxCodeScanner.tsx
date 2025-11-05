import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine, CheckCircle2, XCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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
        .maybeSingle();

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
        items: order.order_items.map((item: any) => ({
          name: item.products.name,
          quantity: item.quantity,
        })),
      };

      setVerifiedOrder(verified);

      // Create scan log entry
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
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Verification Error",
        description: error.message,
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
