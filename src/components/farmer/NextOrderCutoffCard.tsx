import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Calendar, AlertCircle } from 'lucide-react';
import { isCutoffPassed, getNextAvailableDate } from '@/lib/marketHelpers';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface NextOrderCutoffCardProps {
  zipCode: string;
}

export function NextOrderCutoffCard({ zipCode }: NextOrderCutoffCardProps) {
  const { data: marketConfig } = useQuery({
    queryKey: ['market-config', zipCode],
    queryFn: async () => {
      const { data } = await supabase
        .from('market_configs')
        .select('cutoff_time, delivery_days')
        .eq('zip_code', zipCode)
        .eq('active', true)
        .single();
      return data;
    },
    enabled: !!zipCode,
  });

  if (!marketConfig) return null;

  const cutoffPassed = isCutoffPassed(marketConfig.cutoff_time);
  const nextDeliveryDate = getNextAvailableDate(marketConfig.cutoff_time, marketConfig.delivery_days);
  
  const now = new Date();
  const [hour, minute] = marketConfig.cutoff_time.split(':').map(Number);
  const todayCutoff = new Date();
  todayCutoff.setHours(hour, minute, 0, 0);
  
  const hoursUntilCutoff = Math.max(0, (todayCutoff.getTime() - now.getTime()) / (1000 * 60 * 60));
  
  let urgencyLevel: 'green' | 'yellow' | 'red' = 'green';
  if (cutoffPassed || hoursUntilCutoff > 24) {
    urgencyLevel = 'green';
  } else if (hoursUntilCutoff <= 6) {
    urgencyLevel = 'red';
  } else if (hoursUntilCutoff <= 24) {
    urgencyLevel = 'yellow';
  }

  const urgencyVariant = {
    green: 'secondary',
    yellow: 'outline',
    red: 'destructive',
  }[urgencyLevel] as 'secondary' | 'outline' | 'destructive';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Next Order Cutoff
        </CardTitle>
        <CardDescription>Ensure products are ready for pickup</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Today's Cutoff</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">
                {format(todayCutoff, 'h:mm a')}
              </p>
              {!cutoffPassed && hoursUntilCutoff <= 24 && (
                <Badge variant={urgencyVariant}>
                  {hoursUntilCutoff < 1 
                    ? `${Math.round(hoursUntilCutoff * 60)}m left`
                    : `${Math.round(hoursUntilCutoff)}h left`
                  }
                </Badge>
              )}
              {cutoffPassed && (
                <Badge variant="secondary">
                  Passed
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Next Delivery</span>
            </div>
            <p className="text-2xl font-bold">
              {format(nextDeliveryDate, 'EEE, MMM d')}
            </p>
          </div>
        </div>

        {urgencyLevel === 'red' && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">
              Less than 6 hours until cutoff! Ensure all products are updated and ready.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
