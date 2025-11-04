import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import OrderTracking from "@/components/OrderTracking";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/assets/blue-harvests-logo.jpeg";
import { useEffect } from "react";

const LiveTracking = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: activeOrder, isLoading, refetch } = useQuery({
    queryKey: ['active-order', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          total_amount,
          delivery_date,
          box_code,
          order_items(
            quantity,
            products(name, unit)
          ),
          delivery_batches(
            driver_id,
            estimated_duration_minutes,
            profiles!delivery_batches_driver_id_fkey(full_name, phone)
          ),
          profiles!orders_consumer_id_fkey(street_address, city, state, zip_code)
        `)
        .eq('consumer_id', user?.id)
        .in('status', ['confirmed', 'in_transit', 'out_for_delivery'])
        .order('delivery_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });

  // Set up realtime subscription for order status updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `consumer_id=eq.${user.id}`,
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-earth">
        <header className="bg-white border-b shadow-soft">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const driver = activeOrder?.delivery_batches?.profiles;
  const deliveryAddress = activeOrder?.profiles;

  // Map database status to OrderTracking component status
  const mapStatus = (dbStatus: string): "ordered" | "farm_pickup" | "en_route" | "delivered" => {
    switch (dbStatus) {
      case 'confirmed':
        return 'ordered';
      case 'in_transit':
        return 'farm_pickup';
      case 'out_for_delivery':
        return 'en_route';
      case 'delivered':
        return 'delivered';
      default:
        return 'ordered';
    }
  };

  // Format items as a string
  const formatItems = (items: any[]) => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const itemNames = items.map(item => item.products.name).slice(0, 2).join(', ');
    return items.length > 2 
      ? `${itemNames}, +${items.length - 2} more (${itemCount} items total)`
      : `${itemNames} (${itemCount} items)`;
  };

  // Format estimated time
  const formatEstimatedTime = (minutes?: number) => {
    if (!minutes) return undefined;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-earth pb-20 md:pb-8">
      <header className="bg-white border-b shadow-soft sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/consumer/shop")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Blue Harvests" className="h-12 object-contain" />
            <h1 className="text-2xl font-bold text-foreground">Live Tracking</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!activeOrder ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No Active Delivery</h2>
              <p className="text-muted-foreground mb-6">
                You don't have any orders currently being delivered.
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
        ) : (
          <OrderTracking
            orderId={activeOrder.id.slice(0, 8)}
            status={mapStatus(activeOrder.status)}
            driverName={driver?.full_name}
            driverPhone={driver?.phone}
            estimatedTime={formatEstimatedTime(activeOrder.delivery_batches?.estimated_duration_minutes)}
            items={formatItems(activeOrder.order_items || [])}
            total={Number(activeOrder.total_amount)}
            deliveryAddress={deliveryAddress ? 
              `${deliveryAddress.street_address}, ${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.zip_code}` 
              : 'Address not available'
            }
          />
        )}
      </main>
    </div>
  );
};

export default LiveTracking;
