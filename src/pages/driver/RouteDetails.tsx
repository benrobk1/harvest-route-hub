import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation, MapPin, Clock, Package, Phone } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BatchStop {
  id: string;
  address: string;
  status: string;
  sequence_number: number;
  estimated_arrival: string | null;
  notes: string | null;
  orders: {
    id: string;
    total_amount: number;
    profiles: {
      full_name: string;
      phone: string | null;
    };
    order_items: Array<{
      quantity: number;
      products: {
        name: string;
        unit: string;
      };
    }>;
  };
}

export default function RouteDetails() {
  const { user } = useAuth();

  const { data: activeBatch, isLoading } = useQuery({
    queryKey: ["driver-route-details", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_batches")
        .select(
          `
          id,
          batch_number,
          delivery_date,
          status,
          batch_stops (
            id,
            address,
            status,
            sequence_number,
            estimated_arrival,
            notes,
            orders!inner(
              id,
              total_amount,
              profiles!inner(
                full_name,
                phone
              ),
              order_items (
                quantity,
                products (
                  name,
                  unit
                )
              )
            )
          )
        `
        )
        .eq("driver_id", user?.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      // Sort stops by sequence
      const sortedStops = (data.batch_stops as any[])?.sort(
        (a, b) => a.sequence_number - b.sequence_number
      );

      return {
        ...data,
        batch_stops: sortedStops as BatchStop[],
      };
    },
    enabled: !!user?.id,
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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!activeBatch) {
    return (
      <div className="min-h-screen bg-gradient-earth">
        <header className="bg-white border-b shadow-soft">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-foreground">Route Details</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                No active route assigned yet
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const completedStops = activeBatch.batch_stops?.filter((s) => s.status === "delivered").length || 0;
  const totalStops = activeBatch.batch_stops?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Batch #{activeBatch.batch_number}
              </h1>
              <p className="text-sm text-muted-foreground">
                {completedStops} of {totalStops} deliveries completed
              </p>
            </div>
            <Button>
              <Navigation className="h-4 w-4 mr-2" />
              Start Navigation
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-4">
        {activeBatch.batch_stops?.map((stop, index) => (
          <Card
            key={stop.id}
            className={
              stop.status === "delivered"
                ? "opacity-60"
                : stop.status === "in_progress"
                ? "border-primary border-2"
                : ""
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center font-bold ${
                      stop.status === "delivered"
                        ? "bg-success/10 text-success"
                        : stop.status === "in_progress"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {stop.orders?.profiles?.full_name || "Customer"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {stop.address}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    stop.status === "delivered"
                      ? "default"
                      : stop.status === "in_progress"
                      ? "default"
                      : "secondary"
                  }
                >
                  {stop.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {stop.orders?.profiles?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{stop.orders.profiles.phone}</span>
                  </div>
                )}
                {stop.estimated_arrival && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      ETA: {formatDistanceToNow(new Date(stop.estimated_arrival))}
                    </span>
                  </div>
                )}
              </div>

              {stop.orders?.order_items && stop.orders.order_items.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Items to deliver:</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {stop.orders.order_items.map((item: any, idx: number) => (
                      <li key={idx}>
                        • {item.quantity} {item.products?.unit} {item.products?.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {stop.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm">
                    <span className="font-medium">Notes: </span>
                    {stop.notes}
                  </p>
                </div>
              )}

              {stop.status === "pending" && index === completedStops && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1">
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate Here
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Mark as Delivered
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
