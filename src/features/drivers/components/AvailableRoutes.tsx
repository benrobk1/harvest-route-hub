import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, differenceInHours } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";
import { useState, useMemo } from "react";
import { driverQueries } from "@/features/drivers";

export function AvailableRoutes() {
  const { toast } = useToast();
  const [claimedRoutes, setClaimedRoutes] = useState<Set<string>>(new Set());

  // Fetch driver profile for sorting preferences
  const { data: driverProfile } = useQuery({
    queryKey: driverQueries.profile(),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('profiles')
        .select('delivery_days, zip_code')
        .eq('id', user.id)
        .single();
      
      return data;
    },
  });

  const { data: availableBatches, refetch } = useQuery({
    queryKey: driverQueries.availableRoutes(),
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
          lead_farmer_profile:profiles!lead_farmer_id (
            full_name,
            zip_code
          )
        `)
        .eq('status', 'pending')
        .is('driver_id', null)
        .gte('delivery_date', new Date().toISOString().split('T')[0]);
      
      return data;
    },
  });

  // Sort batches by driver's available days and collection point proximity
  const sortedBatches = useMemo(() => {
    if (!availableBatches) return [];

    return [...availableBatches].sort((a: any, b: any) => {
      // If no driver profile, use default sorting
      if (!driverProfile?.delivery_days) {
        return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
      }

      const aDayOfWeek = format(new Date(a.delivery_date), 'EEEE');
      const bDayOfWeek = format(new Date(b.delivery_date), 'EEEE');
      
      const aMatchesPreference = driverProfile.delivery_days?.includes(aDayOfWeek);
      const bMatchesPreference = driverProfile.delivery_days?.includes(bDayOfWeek);

      // Prioritize routes on driver's preferred days
      if (aMatchesPreference && !bMatchesPreference) return -1;
      if (!aMatchesPreference && bMatchesPreference) return 1;

      // For routes on same preference level, sort by zip code proximity
      const aProfile = a.lead_farmer_profile;
      const bProfile = b.lead_farmer_profile;
      
      if (driverProfile.zip_code && aProfile?.zip_code && bProfile?.zip_code) {
        const driverZip = driverProfile.zip_code.substring(0, 3);
        const aZip = aProfile.zip_code.substring(0, 3);
        const bZip = bProfile.zip_code.substring(0, 3);
        
        const aDistance = Math.abs(parseInt(driverZip) - parseInt(aZip));
        const bDistance = Math.abs(parseInt(driverZip) - parseInt(bZip));
        
        if (aDistance !== bDistance) return aDistance - bDistance;
      }

      // Finally sort by date
      return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
    });
  }, [availableBatches, driverProfile]);

  const handleClaimRoute = async (batchId: string, deliveryDate: string) => {
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
      const hoursUntilDelivery = differenceInHours(new Date(deliveryDate), new Date());
      const description = hoursUntilDelivery <= 48 
        ? 'Route claimed! Note: Routes within 48 hours of delivery cannot be unclaimed.'
        : 'Check your active route to begin deliveries';
      
      toast({
        title: 'Route claimed!',
        description,
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
        {!sortedBatches || sortedBatches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No available routes at this time. Check back later for new delivery batches.
          </p>
        ) : (
          sortedBatches.map((batch: any) => (
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
                      {batch.lead_farmer_profile?.full_name || 'Collection Point'}
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
                  onClick={() => handleClaimRoute(batch.id, batch.delivery_date)} 
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
