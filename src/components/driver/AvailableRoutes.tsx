import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useState } from "react";

export function AvailableRoutes() {
  const { toast } = useToast();
  const { isDemoMode, claimDemoRoute } = useDemoMode();
  const [claimedRoutes, setClaimedRoutes] = useState<Set<string>>(new Set());
  
  // Demo batch data
  const demoBatch = {
    id: 'demo-batch-8',
    batch_number: 8,
    delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    status: 'pending',
    batch_stops: [{ count: 40 }],
    batch_metadata: [{
      collection_point_address: '456 Farm Road, Milton, NY 12547',
      estimated_route_hours: 6.5
    }],
    profiles: {
      full_name: 'Thompson Family Farm'
    }
  };

  const { data: availableBatches, refetch } = useQuery({
    queryKey: ['available-routes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          batch_number,
          delivery_date,
          status,
          batch_stops (count),
          batch_metadata (
            collection_point_address,
            estimated_route_hours
          ),
          profiles:lead_farmer_id (
            full_name
          )
        `)
        .eq('status', 'pending')
        .is('driver_id', null)
        .gte('delivery_date', new Date().toISOString().split('T')[0])
        .order('delivery_date', { ascending: true });
      
      return data;
    },
    enabled: !isDemoMode, // Don't fetch real data in demo mode
  });

  // Show demo data if in demo mode, otherwise show real data
  const displayBatches = isDemoMode ? [demoBatch] : availableBatches;
  
  const handleClaimRoute = async (batchId: string) => {
    if (isDemoMode) {
      setClaimedRoutes(prev => new Set(prev).add(batchId));
      claimDemoRoute();
      toast({
        title: 'Route Claimed!',
        description: 'Check your dashboard to see your active route.',
      });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase
      .from('delivery_batches')
      .update({ 
        driver_id: user.id,
        status: 'assigned'
      })
      .eq('id', batchId);
    
    if (error) {
      toast({
        title: 'Failed to claim route',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setClaimedRoutes(prev => new Set(prev).add(batchId));
      toast({
        title: 'Route claimed!',
        description: 'Check your active route to begin deliveries',
      });
      refetch();
    }
  };
  
  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Available Routes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!displayBatches || displayBatches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No available routes at this time. Check back later for new delivery batches.
          </p>
        ) : (
          displayBatches.map((batch) => (
            <div key={batch.id} className="p-6 border rounded-lg hover:border-primary transition-colors bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">#{batch.batch_number}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-foreground">
                        Batch #{batch.batch_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(batch.delivery_date), 'EEEE, MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="ml-15 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {batch.profiles?.full_name || 'Collection Point'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {batch.batch_metadata?.[0]?.collection_point_address || 'Address not available'}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <Badge variant="secondary">
                        {batch.batch_stops?.[0]?.count || 0} stops
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Est. {batch.batch_metadata?.[0]?.estimated_route_hours || 0} hours
                      </span>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => handleClaimRoute(batch.id)} 
                  size="lg"
                  disabled={claimedRoutes.has(batch.id)}
                >
                  {claimedRoutes.has(batch.id) ? 'Claimed' : 'Claim Route'}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
