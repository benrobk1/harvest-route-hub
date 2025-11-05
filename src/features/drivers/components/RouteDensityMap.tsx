import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Info, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { driverQueries } from '@/features/drivers';

interface RouteDensityMapProps {
  batchId: string;
}

export const RouteDensityMap = ({ batchId }: RouteDensityMapProps) => {
  const { data: stops, isLoading: stopsLoading } = useQuery({
    queryKey: driverQueries.routeStops(batchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_batch_stops_secure')
        .select(`
          id,
          sequence_number,
          status,
          street_address,
          city,
          zip_code
        `)
        .eq('delivery_batch_id', batchId)
        .order('sequence_number');

      if (error) throw error;
      return data;
    },
  });

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: driverQueries.deliveryBatch(batchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_batches')
        .select('estimated_duration_minutes, zip_codes')
        .eq('id', batchId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (stopsLoading || batchLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stops || !batch) return null;

  const etaHours = batch.estimated_duration_minutes 
    ? Math.ceil(batch.estimated_duration_minutes / 60) 
    : 8;

  const deliveredCount = stops.filter(s => s.status === 'delivered').length;
  const totalCount = stops.length;
  const progressPercent = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

  const getDensityStatus = (count: number) => {
    if (count >= 35 && count <= 40) return 'excellent';
    if (count >= 30) return 'good';
    return 'warning';
  };

  const densityStatus = getDensityStatus(totalCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Today's Route Density
        </CardTitle>
        <CardDescription>
          {totalCount} stops clustered for maximum efficiency
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual stop grid */}
        <div className="relative min-h-[200px] bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg overflow-hidden p-4 border">
          <div className="grid grid-cols-8 gap-2">
            {stops.map((stop, idx) => (
              <div
                key={stop.id}
                className={cn(
                  'aspect-square rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                  stop.status === 'delivered' 
                    ? 'bg-success text-white shadow-md' 
                    : stop.status === 'in_progress'
                    ? 'bg-primary text-white shadow-md animate-pulse'
                    : 'bg-muted text-muted-foreground'
                )}
                title={`Stop ${stop.sequence_number}: ${stop.street_address}`}
              >
                {stop.sequence_number}
              </div>
            ))}
          </div>
          
          {/* Progress bar */}
          <div className="mt-4 bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="bg-success h-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">
            {deliveredCount} of {totalCount} stops completed
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Route Density</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-foreground">{totalCount}</p>
              <span className="text-sm text-muted-foreground">stops</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Estimated Time</p>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <p className="text-3xl font-bold text-foreground">{etaHours}h</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {batch.zip_codes?.length || 0} ZIP codes
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
