import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMoney } from '@/lib/formatMoney';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Package, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function Financials() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: farmProfile } = useQuery({
    queryKey: ['farm-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('farm_profiles')
        .select('*')
        .eq('farmer_id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['farmer-earnings', farmProfile?.id],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          order_items!inner(
            subtotal,
            products!inner(farm_profile_id)
          )
        `)
        .eq('order_items.products.farm_profile_id', farmProfile?.id)
        .eq('status', 'delivered');

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const today = orders
        ?.filter((o) => new Date(o.created_at) >= todayStart)
        .reduce((sum, o) => sum + o.order_items.reduce((s, i) => s + Number(i.subtotal), 0), 0) || 0;

      const week = orders
        ?.filter((o) => new Date(o.created_at) >= weekAgo)
        .reduce((sum, o) => sum + o.order_items.reduce((s, i) => s + Number(i.subtotal), 0), 0) || 0;

      const month = orders
        ?.filter((o) => new Date(o.created_at) >= monthAgo)
        .reduce((sum, o) => sum + o.order_items.reduce((s, i) => s + Number(i.subtotal), 0), 0) || 0;

      return { today, week, month };
    },
    enabled: !!farmProfile?.id,
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['farmer-recent-orders', farmProfile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          status,
          profiles!inner(full_name),
          order_items!inner(
            quantity,
            subtotal,
            products!inner(name, farm_profile_id)
          )
        `)
        .eq('order_items.products.farm_profile_id', farmProfile?.id)
        .order('created_at', { ascending: false })
        .limit(10);

      return data?.map((order) => ({
        id: order.id,
        customerName: order.profiles.full_name,
        status: order.status,
        total: order.order_items.reduce((sum, item) => sum + Number(item.subtotal), 0),
        items: order.order_items.map((item) => ({
          name: item.products.name,
          quantity: item.quantity,
        })),
        createdAt: order.created_at,
      }));
    },
    enabled: !!farmProfile?.id,
  });

  if (earningsLoading || ordersLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/farmer/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Financial Overview</h1>
          <p className="text-muted-foreground">Track your earnings and orders</p>
        </div>
      </div>

      {/* Earnings Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(earnings?.today || 0)}</div>
            <p className="text-xs text-muted-foreground">From delivered orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(earnings?.week || 0)}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(earnings?.month || 0)}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>Your latest customer orders containing your products</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                  <div className="space-y-1">
                    <p className="font-medium">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(order.total)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No orders yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
