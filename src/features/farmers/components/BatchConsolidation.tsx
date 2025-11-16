import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/formatMoney";
import { farmerQueries } from "@/features/farmers";
import type { Database } from "@/integrations/supabase/types";

interface BatchOrder {
  orderId: string;
  boxCode: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; farmName: string }>;
  sequenceNumber: number;
  status: string;
}

type DeliveryBatchRow = Database['public']['Tables']['delivery_batches']['Row'];
type BatchStopRow = Database['public']['Tables']['batch_stops']['Row'];
type OrderRow = Database['public']['Tables']['orders']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type FarmProfileRow = Database['public']['Tables']['farm_profiles']['Row'];

type DeliveryBatchWithRelations = DeliveryBatchRow & {
  batch_stops: Array<
    (BatchStopRow & {
      orders: (OrderRow & {
        profiles: ProfileRow | null;
        order_items: Array<
          (OrderItemRow & {
            products: (ProductRow & { farm_profiles: FarmProfileRow | null }) | null;
          }) | null
        > | null;
      }) | null;
    }) | null
  > | null;
};

type BatchStopWithOrder = NonNullable<DeliveryBatchWithRelations['batch_stops']>[number];

const hasOrder = (
  stop: BatchStopWithOrder | null
): stop is BatchStopWithOrder & { orders: NonNullable<BatchStopWithOrder['orders']> } => Boolean(stop?.orders);

export const BatchConsolidation = () => {
  const { user } = useAuth();

  const { data: batches, isLoading } = useQuery({
    queryKey: farmerQueries.leadFarmer.batches(user?.id || ''),
    queryFn: async () => {
      // Get batches where user is the lead farmer
      const { data: batchData, error } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          batch_number,
          delivery_date,
          status,
          batch_stops(
            sequence_number,
            status,
            orders!inner(
              id,
              box_code,
              profiles!inner(full_name),
              order_items(
                quantity,
                products(
                  name,
                  farm_profiles(farm_name)
                )
              )
            )
          )
        `)
        .eq('lead_farmer_id', user?.id)
        .gte('delivery_date', new Date().toISOString().split('T')[0])
        .order('delivery_date', { ascending: true })
        .limit(5)
        .returns<DeliveryBatchWithRelations[]>();

      if (error) throw error;

      return (batchData ?? []).map((batch) => ({
        id: batch.id,
        batchNumber: batch.batch_number ?? 0,
        deliveryDate: batch.delivery_date ?? '',
        status: batch.status ?? 'pending',
        orders: (batch.batch_stops ?? [])
          .filter(hasOrder)
          .map((stop) => {
            const order = stop.orders;
            return {
              orderId: order.id,
              boxCode: order.box_code ?? 'N/A',
              customerName: order.profiles?.full_name ?? 'Unknown customer',
              sequenceNumber: stop.sequence_number ?? 0,
              status: stop.status ?? 'pending',
              items: (order.order_items ?? [])
                .filter((item): item is NonNullable<typeof item> => Boolean(item?.products))
                .map((item) => ({
                  name: item.products!.name ?? 'Unknown product',
                  quantity: item.quantity ?? 0,
                  farmName: item.products!.farm_profiles?.farm_name ?? 'Unknown farm',
                })),
            } satisfies BatchOrder;
          }),
      }));
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Batch Consolidation
          </CardTitle>
          <CardDescription>No upcoming batches assigned to you</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {batches.map((batch) => (
        <Card key={batch.id} className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Batch #{batch.batchNumber}
                </CardTitle>
                <CardDescription>
                  Delivery: {new Date(batch.deliveryDate).toLocaleDateString()} • {batch.orders.length} orders
                </CardDescription>
              </div>
              <Badge variant={batch.status === 'in_progress' ? 'default' : 'secondary'}>
                {batch.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Consolidation Checklist</p>
              <p className="text-xs text-muted-foreground">
                Verify each box code matches the order and contains all items below
              </p>
            </div>

            <div className="space-y-3">
              {batch.orders
                .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
                .map((order) => (
                  <div key={order.orderId} className="border-2 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-base px-3">
                            {order.boxCode}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Stop #{order.sequenceNumber}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1">{order.customerName}</p>
                      </div>
                      {order.status === 'delivered' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                    </div>

                    <div className="bg-muted p-3 rounded space-y-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Box Contents:</p>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="text-muted-foreground">
                            x{item.quantity} • {item.farmName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
