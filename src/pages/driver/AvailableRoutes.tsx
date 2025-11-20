import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { driverQueries } from "@/features/drivers";

export default function AvailableRoutes() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { data: availableBatches, refetch } = useQuery({
    queryKey: driverQueries.availableRoutes(),
    queryFn: async () => {
      console.log('Fetching available routes...');
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
            full_name
          )
        `)
        .eq('status', 'pending')
        .is('driver_id', null)
        .gte('delivery_date', new Date().toISOString().split('T')[0])
        .order('delivery_date', { ascending: true });
      
      console.log('Available batches result:', data);
      return data;
    },
  });
  
  const handleClaimRoute = async (batchId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase
      .functions.invoke('claim-route', {
        body: { batch_id: batchId },
      });
    
    if (error) {
      toast({
        title: 'Failed to claim route',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Route claimed!',
        description: 'View your active route to begin deliveries',
      });
      refetch();
      navigate('/driver/dashboard');
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Available Routes</h1>
              <p className="text-sm text-muted-foreground">
                Browse and claim delivery batches
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/driver/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Available Routes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!availableBatches || availableBatches.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No available routes at this time. Check back later for new delivery batches.
                </p>
              </div>
            ) : (
              availableBatches.map((batch) => (
                <div 
                  key={batch.id} 
                  className="p-6 border rounded-lg hover:border-primary transition-colors bg-card space-y-4"
                >
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
                    <Button onClick={() => handleClaimRoute(batch.id)} size="lg">
                      Claim Route
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
import { Package } from "lucide-react";
