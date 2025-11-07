import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { payoutQueries } from '@/features/payouts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatMoney } from '@/lib/formatMoney';
import { format, subDays, startOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface PayoutHistoryChartProps {
  recipientType: 'farmer' | 'driver' | 'lead_farmer_commission';
}

export function PayoutHistoryChart({ recipientType }: PayoutHistoryChartProps) {
  const { user } = useAuth();
  
  const { data: payoutHistory, isLoading } = useQuery({
    queryKey: payoutQueries.history(user?.id || '', recipientType),
    queryFn: async () => {
      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
      
      const { data } = await supabase
        .from('payouts')
        .select('amount, created_at, status')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', recipientType)
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      
      if (!data) return [];
      
      // Group by day
      const groupedByDay = data.reduce((acc, payout) => {
        const day = format(new Date(payout.created_at), 'MMM dd');
        if (!acc[day]) {
          acc[day] = 0;
        }
        acc[day] += Number(payout.amount);
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(groupedByDay).map(([day, amount]) => ({
        day,
        amount,
      }));
    },
    enabled: !!user?.id,
  });
  
  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout History (Last 30 Days)</CardTitle>
      </CardHeader>
      <CardContent>
        {payoutHistory && payoutHistory.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={payoutHistory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                fontSize={12}
                className="text-muted-foreground"
              />
              <YAxis 
                fontSize={12}
                tickFormatter={(value) => `$${value}`}
                className="text-muted-foreground"
              />
              <Tooltip 
                formatter={(value: number) => [formatMoney(value), 'Payout']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No payouts in the last 30 days
          </p>
        )}
      </CardContent>
    </Card>
  );
}
