import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/lib/formatMoney';
import { DollarSign, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { payoutQueries } from '@/features/payouts';

interface Payout {
  id: string;
  amount: number;
  status: string;
  description: string;
  created_at: string;
  completed_at: string | null;
  stripe_transfer_id: string | null;
}

export const PayoutsDashboard = () => {
  const { data: payouts, isLoading } = useQuery({
    queryKey: payoutQueries.all(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Payout[];
    },
  });

  const totalPending = payouts?.filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const totalCompleted = payouts?.filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalCompleted + totalPending)}</div>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalPending)}</div>
            <p className="text-xs text-muted-foreground">
              {payouts?.filter(p => p.status === 'pending').length || 0} pending transfers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(totalCompleted)}</div>
            <p className="text-xs text-muted-foreground">Successfully paid out</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
          <CardDescription>Your latest payout transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {!payouts || payouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payouts yet</p>
              <p className="text-sm">Payouts will appear here once orders are completed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{payout.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(payout.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {payout.completed_at && (
                      <p className="text-xs text-muted-foreground">
                        Completed: {new Date(payout.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-2">
                    <p className="font-bold text-lg">{formatMoney(Number(payout.amount))}</p>
                    {getStatusBadge(payout.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
