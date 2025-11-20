import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CompleteFeedbackDrawer, DisputeDialog } from "@/features/consumers";
import type { OrderWithDetails } from "@/features/orders/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/assets/blue-harvests-logo.jpeg";
import { formatMoney } from "@/lib/formatMoney";
import { useToast } from "@/hooks/use-toast";
import { consumerQueries } from "@/features/consumers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

const ConsumerOrderTracking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null);
  const [disputeOrderId, setDisputeOrderId] = useState<string | null>(null);

  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: consumerQueries.orders(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          consumer_id,
          status,
          total_amount,
          tip_amount,
          delivery_date,
          box_code,
          created_at,
          updated_at,
          delivery_batch_id,
          order_items(
            id,
            quantity,
            unit_price,
            products(
              id,
              name, 
              unit,
              farm_profiles(id, farm_name)
            )
          ),
          delivery_batches(
            driver_id,
            estimated_duration_minutes,
            profiles!delivery_batches_driver_id_fkey(full_name, phone)
          ),
          profiles(
            street_address,
            city,
            state,
            zip_code
          )
        `)
        .eq('consumer_id', user?.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which orders have been rated
      const orderIds = data?.map(o => o.id) || [];
      const { data: ratings } = await supabase
        .from('delivery_ratings')
        .select('order_id, rating')
        .in('order_id', orderIds);

      const ratedOrderIds = new Set(ratings?.map(r => r.order_id) || []);

      // Get credits earned/used for each order
      const { data: creditsData } = await supabase
        .from('credits_ledger')
        .select('order_id, amount, transaction_type')
        .in('order_id', orderIds);

      const creditsMap = new Map();
      creditsData?.forEach(credit => {
        if (!creditsMap.has(credit.order_id)) {
          creditsMap.set(credit.order_id, { earned: 0, used: 0 });
        }
        if (credit.transaction_type === 'earned') {
          creditsMap.get(credit.order_id).earned += Number(credit.amount);
        } else if (credit.transaction_type === 'redeemed') {
          creditsMap.get(credit.order_id).used += Math.abs(Number(credit.amount));
        }
      });

      return data?.map(order => ({
        ...order,
        hasRating: ratedOrderIds.has(order.id),
        creditsEarned: creditsMap.get(order.id)?.earned || 0,
        creditsUsed: creditsMap.get(order.id)?.used || 0,
      })) || [];
    },
    enabled: !!user?.id,
  });

  const cancelOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('cancel-order', {
        body: { orderId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Order Deleted",
        description: "Your order has been cancelled and removed.",
      });
      refetch();
      setCancelOrderId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Cancellation Failed",
        description: error.message,
        variant: "destructive",
      });
      setCancelOrderId(null);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-earth">
        <header className="bg-white border-b shadow-soft">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {[1, 2].map(i => <Skeleton key={i} className="h-64 w-full mb-6" />)}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-earth pb-20 md:pb-8">
      <header className="bg-white border-b shadow-soft sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/consumer/shop")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Blue Harvests" className="h-12 object-contain" />
            <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {!orders || orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No orders yet</p>
              <Button onClick={() => navigate('/consumer/shop')}>
                Start Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const driver = order.delivery_batches?.profiles;
              const itemCount = order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

              return (
                <Card key={order.id} className="border-2">
                  <CardContent className="p-6 space-y-4">
                    {/* Order Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">Order #{order.id.slice(0, 8)}</h3>
                          {order.box_code && (
                            <Badge variant="outline" className="font-mono">
                              {order.box_code}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Placed {new Date(order.created_at).toLocaleDateString()} • {itemCount} items
                        </p>
                      </div>
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </div>

                    {/* Order Details */}
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Delivery Date:</span>
                        <span className="font-medium">
                          {new Date(order.delivery_date).toLocaleDateString()}
                        </span>
                      </div>
                      {order.box_code && (
                        <div className="flex justify-between text-sm">
                          <span>Box Code:</span>
                          <span className="font-mono font-medium">{order.box_code}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span>Total:</span>
                        <span className="font-medium">{formatMoney(Number(order.total_amount))}</span>
                      </div>
                      {order.tip_amount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Driver Tip:</span>
                          <span className="font-medium">{formatMoney(Number(order.tip_amount))}</span>
                        </div>
                      )}
                      {order.creditsUsed > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Credits Applied:</span>
                          <span className="font-medium">-{formatMoney(order.creditsUsed)}</span>
                        </div>
                      )}
                      {order.creditsEarned > 0 && (
                        <div className="p-2 bg-green-50 dark:bg-green-950 rounded mt-2 text-sm text-green-700 dark:text-green-300">
                          <strong>+${order.creditsEarned.toFixed(2)}</strong> credit earned from this order (available next month)
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Items:</p>
                      <div className="space-y-1">
                        {order.order_items?.map((item, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <button
                              onClick={() => {
                                if (item.products?.farm_profiles?.id) {
                                  navigate(`/farm/${item.products.farm_profiles.id}`);
                                }
                              }}
                              className="text-left hover:text-primary underline-offset-2 hover:underline"
                            >
                              {item.products.name}
                            </button>
                            <span className="text-muted-foreground">
                              {item.quantity} {item.products.unit} × {formatMoney(Number(item.unit_price))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Driver Info */}
                    {driver && (
                      <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
                        <p className="text-sm font-medium">Driver: {driver.full_name}</p>
                        {driver.phone && (
                          <p className="text-xs text-muted-foreground">Phone: {driver.phone}</p>
                        )}
                      </div>
                    )}

                    {/* Rating Section for Delivered Orders */}
                    {order.status === 'delivered' && !order.hasRating && (
                      <div className="pt-4 border-t space-y-2">
                        <Button
                          onClick={() => setFeedbackOrderId(order.id)}
                          className="w-full"
                        >
                          Rate Your Experience
                        </Button>
                        <Button
                          onClick={() => setDisputeOrderId(order.id)}
                          variant="outline"
                          className="w-full"
                        >
                          File a Dispute
                        </Button>
                      </div>
                    )}

                    {order.hasRating && (
                      <div className="pt-4 border-t space-y-2">
                        <p className="text-sm text-green-600 text-center py-2">
                          ✓ You've submitted feedback for this order
                        </p>
                        <Button
                          onClick={() => setDisputeOrderId(order.id)}
                          variant="outline"
                          className="w-full"
                        >
                          File a Dispute
                        </Button>
                      </div>
                    )}

                    {/* Cancel Order Button */}
                    {(() => {
                      const canCancel = ['pending', 'paid', 'confirmed'].includes(order.status);
                      const deliveryTime = new Date(order.delivery_date).getTime();
                      const now = Date.now();
                      const hoursUntilDelivery = (deliveryTime - now) / (1000 * 60 * 60);
                      const isWithinCancellationWindow = hoursUntilDelivery > 24;

                      return canCancel && isWithinCancellationWindow ? (
                        <div className="pt-4 border-t">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => setCancelOrderId(order.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel Order
                          </Button>
                          <p className="text-xs text-muted-foreground text-center mt-2">
                            Can cancel until 24 hours before delivery
                          </p>
                        </div>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelOrderId} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelOrderId && cancelOrder.mutate(cancelOrderId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Feedback Drawer */}
      {feedbackOrderId && orders && (
        <CompleteFeedbackDrawer
          open={!!feedbackOrderId}
          onOpenChange={(open) => {
            if (!open) setFeedbackOrderId(null);
          }}
          order={orders.find(o => o.id === feedbackOrderId) as OrderWithDetails}
          hasDriverRating={orders.find(o => o.id === feedbackOrderId)?.hasRating || false}
        />
      )}

      {/* Dispute Dialog */}
      {disputeOrderId && orders && (
        <DisputeDialog
          open={!!disputeOrderId}
          onOpenChange={(open) => {
            if (!open) setDisputeOrderId(null);
          }}
          orderId={disputeOrderId}
          consumerId={user?.id || ""}
          totalAmount={Number(orders.find(o => o.id === disputeOrderId)?.total_amount || 0)}
        />
      )}
    </div>
  );
};

export default ConsumerOrderTracking;
