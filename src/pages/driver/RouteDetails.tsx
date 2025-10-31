import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BoxCodeScanner } from "@/components/driver/BoxCodeScanner";
import { Navigation, MapPin, Clock, Package, Phone, AlertCircle, FileText } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, formatDistanceToNow } from "date-fns";
import { generateRouteManifestPDF, type RouteManifestData } from '@/lib/pdfGenerator';
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface BatchStop {
  id: string;
  address: string;
  status: string;
  sequence_number: number;
  estimated_arrival: string | null;
  notes: string | null;
  orders: {
    id: string;
    box_code: string | null;
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
  const navigate = useNavigate();
  const { toast } = useToast();

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
                    {stop.orders?.box_code && (
                      <Badge variant="outline" className="font-mono mt-1">
                        Box: {stop.orders.box_code}
                      </Badge>
                    )}
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
        </div>
      </main>
    </div>
  );
}
