import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Truck, MapPin, Package, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface BatchStop {
  id: string;
  sequence_number: number;
  status: string;
  address_visible_at: string | null;
  orders: {
    id: string;
    consumer_id: string;
    consumer: {
      full_name: string;
      street_address: string;
      city: string;
      state: string;
      zip_code: string;
    } | null;
  } | null;
}

interface DeliveryBatch {
  id: string;
  batch_number: number;
  status: string;
  delivery_date: string;
  created_at: string;
  driver: {
    full_name: string;
  } | null;
  batch_stops: BatchStop[];
}

export default function LiveOrderStatus() {
  const [realtimeData, setRealtimeData] = useState<DeliveryBatch[]>([]);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['active-deliveries'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          batch_number,
          status,
          delivery_date,
          created_at,
          driver:driver_id (
            full_name
          ),
          batch_stops (
            id,
            sequence_number,
            status,
            address_visible_at,
            orders:order_id (
              id,
              consumer_id,
              consumer:consumer_id (
                full_name,
                street_address,
                city,
                state,
                zip_code
              )
            )
          )
        `)
        .gte('delivery_date', today)
        .in('status', ['pending', 'in_progress'])
        .order('batch_number', { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30000, // Fallback polling every 30s
  });

  // Set up realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('delivery-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_batches',
        },
        (payload) => {
          console.log('Batch update:', payload);
          // Refetch when batches change
          window.location.reload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'batch_stops',
        },
        (payload) => {
          console.log('Stop update:', payload);
          // Refetch when stops change
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayBatches = realtimeData.length > 0 ? realtimeData : batches || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'delivered':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Truck className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Delivery Tracking</h1>
          <p className="text-muted-foreground">Real-time status of active deliveries</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live Updates
        </Badge>
      </div>

      {displayBatches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No Active Deliveries</p>
            <p className="text-sm text-muted-foreground">
              All deliveries for today have been completed
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayBatches.map((batch) => (
            <Card key={batch.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Batch #{batch.batch_number}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Driver: {batch.driver?.full_name || 'Unassigned'}
                    </p>
                  </div>
                  <Badge className={getStatusColor(batch.status)}>
                    {getStatusIcon(batch.status)}
                    <span className="ml-1 capitalize">{batch.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Delivery: {format(new Date(batch.delivery_date), 'MMM d, yyyy')}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Stops ({batch.batch_stops.length})</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {batch.batch_stops
                      .sort((a, b) => a.sequence_number - b.sequence_number)
                      .map((stop) => (
                        <div
                          key={stop.id}
                          className={`p-3 rounded-lg border ${
                            stop.status === 'delivered'
                              ? 'bg-green-500/5 border-green-500/20'
                              : stop.status === 'in_progress'
                              ? 'bg-blue-500/5 border-blue-500/20'
                              : 'bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-xs font-medium">
                                {stop.sequence_number}
                              </div>
                              <span className="text-sm font-medium">
                                {stop.orders?.consumer?.full_name || 'Customer'}
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${getStatusColor(stop.status)}`}
                            >
                              {getStatusIcon(stop.status)}
                            </Badge>
                          </div>
                          {stop.address_visible_at && stop.orders?.consumer && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>
                                {stop.orders.consumer.street_address}, {stop.orders.consumer.city}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
