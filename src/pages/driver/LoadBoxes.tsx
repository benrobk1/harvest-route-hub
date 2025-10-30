import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BoxCodeScanner } from "@/components/driver/BoxCodeScanner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle2, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadBoxes() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadedBoxes, setLoadedBoxes] = useState<Set<string>>(new Set());

  const { data: batchData, isLoading } = useQuery({
    queryKey: ["batch-orders", batchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_batches")
        .select(`
          id,
          batch_number,
          batch_stops (
            id,
            order_id,
            orders!inner (
              id,
              box_code
            )
          )
        `)
        .eq("id", batchId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!batchId,
  });

  const totalBoxes = batchData?.batch_stops?.length || 0;
  const loadedCount = loadedBoxes.size;
  const progress = totalBoxes > 0 ? (loadedCount / totalBoxes) * 100 : 0;
  const allLoaded = loadedCount === totalBoxes && totalBoxes > 0;

  const handleScanComplete = (orderId: string, boxCode: string) => {
    setLoadedBoxes((prev) => new Set(prev).add(boxCode));
    toast({
      title: "Box Loaded",
      description: `${boxCode} scanned successfully`,
    });
  };

  const handleStartRoute = () => {
    if (!allLoaded) {
      toast({
        title: "Not Ready",
        description: "Please load all boxes before starting route",
        variant: "destructive",
      });
      return;
    }
    navigate(`/driver/route/${batchId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            Load Boxes - Batch #{batchData?.batch_number}
          </CardTitle>
          <CardDescription>
            Scan each box code before departing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Progress: {loadedCount}/{totalBoxes} boxes
              </span>
              <Badge variant={allLoaded ? "default" : "secondary"}>
                {Math.round(progress)}%
              </Badge>
            </div>
            <Progress value={progress} />
          </div>

          {allLoaded && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-900">
                All boxes loaded! Ready to start route.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <BoxCodeScanner
        mode="loading"
        batchId={batchId}
        onScanComplete={handleScanComplete}
      />

      <Card>
        <CardHeader>
          <CardTitle>Boxes to Load</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {batchData?.batch_stops?.map((stop: any) => {
              const boxCode = stop.orders.box_code;
              const isLoaded = loadedBoxes.has(boxCode);
              return (
                <div
                  key={stop.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-medium">{boxCode}</span>
                  </div>
                  {isLoaded && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Loaded
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleStartRoute}
        disabled={!allLoaded}
        size="lg"
        className="w-full"
      >
        <Truck className="h-5 w-5 mr-2" />
        Start Route
      </Button>
    </div>
  );
}
