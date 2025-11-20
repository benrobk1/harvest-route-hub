import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, Package, DollarSign, MapPin, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/lib/formatMoney";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import logo from "@/assets/blue-harvests-logo.jpeg";
import { consumerQueries } from "@/features/consumers";

const OrderSuccess = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();

  const { data: order, isLoading } = useQuery({
    queryKey: consumerQueries.orderSuccess(orderId || ''),
    queryFn: async () => {
      if (!orderId) throw new Error('No order ID provided');
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          tip_amount,
          delivery_date,
          box_code,
          created_at,
          order_items(
            quantity,
            unit_price,
            subtotal,
            products(
              name,
              unit,
              farm_profiles(id, farm_name)
            )
          )
        `)
        .eq('id', orderId)
        .eq('consumer_id', user?.id)
        .single();

      if (error) throw error;

      // Get credits used for this order
      const { data: creditsData } = await supabase
        .from('credits_ledger')
        .select('amount, transaction_type')
        .eq('order_id', orderId);

      const creditsUsed = creditsData
        ?.filter(c => c.transaction_type === 'redemption')
        .reduce((sum, c) => sum + Math.abs(Number(c.amount)), 0) || 0;

      return { ...data, creditsUsed };
    },
    enabled: !!orderId && !!user?.id,
    retry: 3,
    retryDelay: 1000,
  });

  // Redirect to orders if no order ID
  useEffect(() => {
    if (!orderId) {
      navigate('/consumer/orders');
    }
  }, [orderId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardHeader>
            <Skeleton className="h-8 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Order not found</p>
            <Button onClick={() => navigate('/consumer/orders')}>
              View All Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const deliveryDate = new Date(order.delivery_date);

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-4">
            <img src={logo} alt="Blue Harvests" className="h-12 object-contain" />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-12">
        <Card className="border-2 border-green-500">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 dark:bg-green-950 rounded-full p-4">
                <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold mb-2">Order Confirmed!</CardTitle>
            <p className="text-muted-foreground text-lg">
              Your order has been successfully placed
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Delivery Info */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold text-lg">Delivery Date</p>
                  <p className="text-2xl font-bold text-primary">
                    {format(deliveryDate, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your order will be delivered on this date
                  </p>
                </div>
              </div>

              {order.box_code && (
                <div className="flex items-start gap-3 pt-3 border-t">
                  <Package className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-semibold">Box Code</p>
                    <p className="text-xl font-mono font-bold text-primary">
                      {order.box_code}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Summary
              </h3>
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono font-medium">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items:</span>
                  <span className="font-medium">{itemCount} items</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">
                    {formatMoney(order.order_items?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0)}
                  </span>
                </div>
                {order.tip_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Driver Tip:</span>
                    <span className="font-medium">{formatMoney(Number(order.tip_amount))}</span>
                  </div>
                )}
                {order.creditsUsed > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      Credits Applied:
                    </span>
                    <span className="font-medium">-{formatMoney(order.creditsUsed)}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Total Paid:</span>
                  <span className="font-bold text-lg">{formatMoney(Number(order.total_amount))}</span>
                </div>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Items Ordered</h3>
              <div className="space-y-2">
                {order.order_items?.map((item, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{item.products.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.products.farm_profiles.farm_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatMoney(Number(item.subtotal))}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.products.unit} × {formatMoney(Number(item.unit_price))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What's Next */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                What happens next?
              </h3>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• You'll receive updates on your order status</li>
                <li>• Your driver will be assigned closer to the delivery date</li>
                <li>• Track your delivery in real-time on delivery day</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={() => navigate('/consumer/orders')}
                className="flex-1"
                size="lg"
              >
                <Package className="h-5 w-5 mr-2" />
                View My Orders
              </Button>
              <Button
                onClick={() => navigate('/consumer/shop')}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                Continue Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default OrderSuccess;
