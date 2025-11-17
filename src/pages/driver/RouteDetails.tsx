/**
 * ROUTE DETAILS PAGE
 * 
 * Displays delivery route information for drivers including stops, addresses, and navigation.
 * 
 * **ADDRESS PRIVACY IMPLEMENTATION**
 * 
 * This page implements the client-side portion of the address privacy system:
 * 
 * DATA FLOW:
 * 1. Query uses `driver_batch_stops_secure` view (not raw batch_stops table)
 * 2. View applies RLS policy: addresses visible only when `address_visible_at IS NOT NULL`
 * 3. Collection point address is ALWAYS visible (farmers are public)
 * 4. Consumer delivery addresses are HIDDEN until driver scans box at collection point
 * 
 * UI BEHAVIOR:
 * - Before box scan: Drivers see ZIP code + approximate location only
 * - After box scan: Full street address becomes visible
 * - This is enforced at the DATABASE LEVEL via RLS policies
 * 
 * WHY THIS DESIGN:
 * - Prevents drivers from cherry-picking "good" routes before claiming
 * - Protects consumer privacy until pickup is confirmed
 * - Ensures fair route distribution across all drivers
 * 
 * @see {@link https://github.com/yourusername/blue-harvests/blob/main/ARCHITECTURE.md#operational-safety-driver-address-privacy}
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BoxCodeScanner } from "@/features/drivers";
import { Navigation, MapPin, Clock, Package, Phone, AlertCircle, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";
import { generateRouteManifestPDF, type RouteManifestData } from '@/lib/pdfGenerator';
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type DriverBatchStopSecure = Database["public"]["Views"]["driver_batch_stops_secure"]["Row"];

type OrderItemDetails = {
  quantity: number;
  products: { name: string | null; unit: string | null } | null;
};

type OrderDetails = {
  id: string;
  box_code: string | null;
  total_amount: number;
  profiles: { full_name: string | null; phone: string | null } | null;
  order_items: OrderItemDetails[] | null;
};

type BatchStop = {
  id: string;
  address: string | null;
  status: string | null;
  sequence_number: number;
  estimated_arrival: string | null;
  notes: string | null;
  order_id?: string | null;
  orders: OrderDetails;
};

type RouteBatchResult = {
  id: string;
  batch_number: number;
  delivery_date: string;
  status: string;
  lead_farmer_id: string | null;
  batch_metadata: Array<{ collection_point_address: string | null }>; // join returns array
  profiles: { full_name: string | null; farm_name: string | null } | null;
  driver_batch_stops_secure: DriverBatchStopSecure[] | null;
};

export default function RouteDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: activeBatch, isLoading } = useQuery({
    queryKey: ["driver-route-details", user?.id],
    queryFn: async () => {
      /**
       * ADDRESS PRIVACY: Using driver_batch_stops_secure view
       * 
       * This view applies RLS policies that:
       * 1. Show full addresses ONLY when address_visible_at IS NOT NULL
       * 2. Before box scan: Returns NULL or partial address data
       * 3. After box scan: Returns full street address
       * 
       * The view query checks:
       * - has_role(auth.uid(), 'driver') AND address_visible_at IS NOT NULL
       * - OR has_role(auth.uid(), 'admin') -- admins always see addresses
       * 
       * This is the database-level enforcement mechanism.
       */
      const { data } = await supabase
        .from("delivery_batches")
        .select(
          `
          id,
          batch_number,
          delivery_date,
          status,
          lead_farmer_id,
          batch_metadata!inner(
            collection_point_address
          ),
          profiles:lead_farmer_id(
            full_name,
            farm_name
          ),
          driver_batch_stops_secure!inner (
            id,
            address,
            status,
            sequence_number,
            estimated_arrival,
            notes,
            order_id
          )
        `
        )
        .returns<RouteBatchResult>()
        .eq("driver_id", user?.id)
        .in("status", ["assigned", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      // Create collection point stop
      const collectionPointStop: BatchStop = {
        id: 'collection-point',
        sequence_number: 0,
        address: data.batch_metadata?.[0]?.collection_point_address || 'Collection Point',
        status: 'pending',
        estimated_arrival: null,
        notes: 'Pick up all boxes from farm',
        orders: {
          id: 'collection',
          box_code: null,
          total_amount: 0,
          profiles: {
            full_name: data.profiles?.farm_name || data.profiles?.full_name || 'Farm',
            phone: null
          },
          order_items: []
        }
      };

      // Get order details separately
      const orderIds = (data.driver_batch_stops_secure ?? [])
        .map(stop => stop.order_id)
        .filter((id): id is string => Boolean(id));
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          box_code,
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
        `)
        .in('id', orderIds)
        .returns<OrderDetails[]>();

      // Create order map for lookup
      const orderMap = new Map((orders ?? []).map(o => [o.id, o]));

      const fallbackOrder: OrderDetails = {
        id: 'unknown-order',
        box_code: null,
        total_amount: 0,
        profiles: { full_name: 'Customer', phone: null },
        order_items: [],
      };

      // Merge stop data with order data
      const stopsWithOrders = (data.driver_batch_stops_secure ?? []).map<BatchStop>((stop) => ({
        ...stop,
        address: stop.address,
        status: stop.status,
        orders: orderMap.get(stop.order_id ?? '') ?? fallbackOrder,
      }));

      // Sort stops by sequence
      const sortedStops = stopsWithOrders.sort(
        (a, b) => a.sequence_number - b.sequence_number
      );

      return {
        ...data,
        batch_stops: [collectionPointStop, ...sortedStops],
      };
    },
    enabled: !!user?.id,
  });

  // Check if boxes have been loaded
  const { data: loadedBoxes } = useQuery({
    queryKey: ["loaded-boxes", activeBatch?.id],
    queryFn: async () => {
      if (!activeBatch?.id) return [];
      
      const { data } = await supabase
        .from("delivery_scan_logs")
        .select("box_code")
        .eq("batch_id", activeBatch.id)
        .eq("scan_type", "loaded");
      
      return data || [];
    },
    enabled: !!activeBatch?.id,
  });

  const totalBoxes = activeBatch?.batch_stops?.length || 0;
  const loadedCount = loadedBoxes?.length || 0;
  const allBoxesLoaded = loadedCount === totalBoxes && totalBoxes > 0;

  const handleDownloadManifest = async () => {
    if (!activeBatch) return;

    const { data: driverProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user?.id)
      .single();

    const manifestData: RouteManifestData = {
      batchNumber: activeBatch.batch_number.toString(),
      deliveryDate: format(new Date(activeBatch.delivery_date), 'MMMM dd, yyyy'),
      driverName: driverProfile?.full_name || 'Driver',
      totalStops: activeBatch.batch_stops?.length || 0,
      stops: activeBatch.batch_stops?.map((stop) => ({
        sequence: stop.sequence_number,
        customerName: stop.orders?.profiles?.full_name || 'Customer',
        address: stop.address,
        phone: stop.orders?.profiles?.phone || null,
        boxCode: stop.orders?.box_code || null,
        items: stop.orders?.order_items?.map((item) => ({
          name: item.products?.name || '',
          quantity: item.quantity,
          unit: item.products?.unit || '',
        })) || [],
        notes: stop.notes,
        estimatedArrival: stop.estimated_arrival 
          ? format(new Date(stop.estimated_arrival), 'h:mm a')
          : null,
      })) || [],
    };

    generateRouteManifestPDF(manifestData);
    
    toast({
      title: 'Route manifest downloaded',
      description: 'PDF saved to your downloads folder',
    });
  };

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
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={handleDownloadManifest}>
                      <FileText className="h-4 w-4 mr-2" />
                      Download Paper Backup
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print route manifest for offline backup</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button>
                <Navigation className="h-4 w-4 mr-2" />
                Start Navigation
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Box Loading Alert */}
        {!allBoxesLoaded && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Load Boxes Before Starting</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                Scan all boxes when loading ({loadedCount}/{totalBoxes} loaded)
              </span>
              <Button 
                onClick={() => navigate(`/driver/load/${activeBatch.id}`)}
                size="sm"
              >
                Load Boxes
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Box Code Scanner for Delivery */}
        {allBoxesLoaded && <BoxCodeScanner mode="delivery" batchId={activeBatch.id} />}

        {/* Route Stops */}
        <div className="space-y-4">
        {activeBatch.batch_stops?.map((stop, index) => {
          const isCollectionPoint = stop.sequence_number === 0;
          return (
          <Card
            key={stop.id}
            className={
              stop.status === "delivered"
                ? "opacity-60"
                : stop.status === "in_progress"
                ? "border-primary border-2"
                : isCollectionPoint
                ? "border-accent border-2 bg-accent/5"
                : ""
            }
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center font-bold ${
                      isCollectionPoint
                        ? "bg-accent text-accent-foreground"
                        : stop.status === "delivered"
                        ? "bg-success/10 text-success"
                        : stop.status === "in_progress"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCollectionPoint ? <Package className="h-6 w-6" /> : index}
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {stop.orders?.profiles?.full_name || "Customer"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {stop.address}
                    </p>
                    {stop.orders?.box_code && (
                      <Badge variant="outline" className="font-mono mt-1">
                        Box: {stop.orders.box_code}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge
                  variant={
                    isCollectionPoint
                      ? "outline"
                      : stop.status === "delivered"
                      ? "default"
                      : stop.status === "in_progress"
                      ? "default"
                      : "secondary"
                  }
                >
                  {isCollectionPoint ? "Collection Point" : stop.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isCollectionPoint && (
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
              )}

              {stop.orders?.order_items && stop.orders.order_items.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Items to deliver:</span>
                  </div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {stop.orders.order_items.map((item, idx) => (
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

              {!isCollectionPoint && stop.status === "pending" && index === completedStops && (
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

              {isCollectionPoint && (
                <div className="pt-2">
                  <Button className="w-full">
                    <Navigation className="h-4 w-4 mr-2" />
                    Navigate to Farm
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )})}
        </div>
      </main>
    </div>
  );
}
