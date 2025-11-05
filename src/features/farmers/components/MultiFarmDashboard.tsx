import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMoney } from '@/lib/formatMoney';
import { Skeleton } from '@/components/ui/skeleton';
import { farmerQueries } from '@/features/farmers';

export function MultiFarmDashboard() {
  const { user } = useAuth();
  
  const { data: affiliatedFarms, isLoading: farmsLoading } = useQuery({
    queryKey: farmerQueries.affiliatedFarms(user?.id || ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('farm_affiliations')
        .select(`
          *,
          farm_profiles (
            id,
            farm_name,
            farmer_id,
            profiles (full_name)
          )
        `)
        .eq('lead_farmer_id', user?.id)
        .eq('active', true);
      
      return data || [];
    },
    enabled: !!user?.id,
  });
  
  const { data: aggregateEarnings, isLoading: earningsLoading } = useQuery({
    queryKey: farmerQueries.aggregateEarnings(user?.id || ''),
    queryFn: async () => {
      // Calculate commission from all affiliated farms
      const { data: commissions } = await supabase
        .from('payouts')
        .select('amount, created_at')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'lead_farmer_commission')
        .eq('status', 'completed');
      
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const today = commissions?.filter(c => 
        new Date(c.created_at) >= todayStart
      ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const week = commissions?.filter(c => 
        new Date(c.created_at) >= weekAgo
      ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const month = commissions?.filter(c => 
        new Date(c.created_at) >= monthAgo
      ).reduce((sum, c) => sum + Number(c.amount), 0) || 0;
      
      return { today, week, month };
    },
    enabled: !!user?.id,
  });
  
  if (farmsLoading || earningsLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  if (!affiliatedFarms || affiliatedFarms.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Multi-Farm Coordination</CardTitle>
          <CardDescription>
            You coordinate {affiliatedFarms.length} {affiliatedFarms.length === 1 ? 'farm' : 'farms'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today's Commission
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatMoney(aggregateEarnings?.today || 0)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatMoney(aggregateEarnings?.week || 0)}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatMoney(aggregateEarnings?.month || 0)}</div>
              </CardContent>
            </Card>
          </div>
          
        <div className="space-y-4">
          <h3 className="font-semibold">Affiliated Farms</h3>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/farmer/affiliated-farmers'}
            className="w-full mb-4"
          >
            View All Affiliated Farmers
          </Button>
          {affiliatedFarms.slice(0, 3).map((affiliation) => (
              <Card key={affiliation.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{affiliation.farm_profiles?.farm_name || 'Unknown Farm'}</h4>
                      <p className="text-sm text-muted-foreground">
                        Farmer: {affiliation.farm_profiles?.profiles?.full_name || 'Unknown Farmer'}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {affiliation.commission_rate}% commission
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
