import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { payoutQueries } from '@/features/payouts';
import { formatMoney } from '@/lib/formatMoney';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface PayoutDetailsTableProps {
  recipientType: 'farmer' | 'driver' | 'lead_farmer_commission';
}

export function PayoutDetailsTable({ recipientType }: PayoutDetailsTableProps) {
  const { user } = useAuth();
  
  const { data: payouts, isLoading } = useQuery({
    queryKey: payoutQueries.details(user?.id || '', recipientType),
    queryFn: async () => {
      const { data } = await supabase
        .from('payouts')
        .select('*')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', recipientType)
        .order('created_at', { ascending: false })
        .limit(20);
      
      return data || [];
    },
    enabled: !!user?.id,
  });
  
  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Payouts</CardTitle>
      </CardHeader>
      <CardContent>
        {payouts && payouts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id}>
                  <TableCell>{format(new Date(payout.created_at), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="text-sm">{payout.description || 'Payout'}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(Number(payout.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={payout.status === 'completed' ? 'default' : 'secondary'}>
                      {payout.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No payouts found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
