import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, TrendingUp, Star, Navigation, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/formatMoney";

const DriverDashboard = () => {
  const { user } = useAuth();

  // Fetch earnings from delivery fees and tips
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['driver-earnings', user?.id],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const monthStart = new Date(now.setDate(now.getDate() - 30)).toISOString();

      // Get payouts for driver (includes delivery fees + tips)
      const { data: todayPayouts } = await supabase
        .from('payouts')
        .select('amount, description')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'driver')
        .gte('created_at', todayStart);

      const { data: weekPayouts } = await supabase
        .from('payouts')
        .select('amount, description')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'driver')
        .gte('created_at', weekStart);

      const { data: monthPayouts } = await supabase
        .from('payouts')
        .select('amount, description')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'driver')
        .gte('created_at', monthStart);

      // Get orders with tips for driver
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('tip_amount, delivery_batches!inner(driver_id)')
        .eq('delivery_batches.driver_id', user?.id)
        .gte('created_at', todayStart);

      const { data: weekOrders } = await supabase
        .from('orders')
        .select('tip_amount, delivery_batches!inner(driver_id)')
        .eq('delivery_batches.driver_id', user?.id)
        .gte('created_at', weekStart);

      const { data: monthOrders } = await supabase
        .from('orders')
        .select('tip_amount, delivery_batches!inner(driver_id)')
        .eq('delivery_batches.driver_id', user?.id)
        .gte('created_at', monthStart);

      const todayTips = todayOrders?.reduce((sum, o) => sum + Number(o.tip_amount || 0), 0) || 0;
      const weekTips = weekOrders?.reduce((sum, o) => sum + Number(o.tip_amount || 0), 0) || 0;
      const monthTips = monthOrders?.reduce((sum, o) => sum + Number(o.tip_amount || 0), 0) || 0;

      const todayTotal = todayPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const weekTotal = weekPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const monthTotal = monthPayouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      return {
        today: { total: todayTotal, tips: todayTips, deliveryFees: todayTotal - todayTips },
        week: { total: weekTotal, tips: weekTips, deliveryFees: weekTotal - weekTips },
        month: { total: monthTotal, tips: monthTips, deliveryFees: monthTotal - monthTips },
      };
    },
    enabled: !!user?.id,
  });

  // Fetch active route
  const { data: activeRoute, isLoading: routeLoading } = useQuery({
    queryKey: ['driver-active-route', user?.id],
    queryFn: async () => {
      const { data: batch } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          batch_stops (
            id,
            address,
            status,
            sequence_number,
            orders!inner(
              profiles!inner(full_name)
            )
          )
        `)
        .eq('driver_id', user?.id)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return batch?.batch_stops
        ?.sort((a, b) => a.sequence_number - b.sequence_number)
        .map(stop => ({
          id: stop.id,
          customer: stop.orders?.profiles?.full_name || 'Unknown',
          address: stop.address,
          status: stop.status,
        })) || [];
    },
    enabled: !!user?.id,
  });

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['driver-stats', user?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayStops } = await supabase
        .from('batch_stops')
        .select('id, status, delivery_batches!inner(driver_id)')
        .eq('delivery_batches.driver_id', user?.id)
        .gte('created_at', todayStart.toISOString());

      const deliveredToday = todayStops?.filter(s => s.status === 'delivered').length || 0;

      return {
        deliveries: deliveredToday,
        rating: 4.9, // TODO: Implement rating system
        onTime: 98, // TODO: Calculate from delivery times
      };
    },
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Driver Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back! You have {stats?.deliveries || 0} deliveries today
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Earnings Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Earnings
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {earningsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.today.total || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Delivery: {formatMoney(earnings?.today.deliveryFees || 0)} + Tips: {formatMoney(earnings?.today.tips || 0)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Week
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {earningsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.week.total || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Including {formatMoney(earnings?.week.tips || 0)} in tips</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
              <Package className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              {earningsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.month.total || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.deliveries || 0} deliveries | {formatMoney(earnings?.month.tips || 0)} tips
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Stats */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                    <Star className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.rating || 0}</div>
                    <div className="text-sm text-muted-foreground">Customer Rating</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.onTime || 0}%</div>
                    <div className="text-sm text-muted-foreground">On-Time Delivery</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.deliveries || 0}</div>
                    <div className="text-sm text-muted-foreground">Today's Deliveries</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Route */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Route</CardTitle>
            <Button onClick={() => window.location.href = '/driver/route'}>
              <Navigation className="h-4 w-4 mr-2" />
              View Full Route
            </Button>
          </CardHeader>
          <CardContent>
            {routeLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : activeRoute && activeRoute.length > 0 ? (
              <div className="space-y-4">
                {activeRoute.map((stop, index) => (
                  <div
                    key={stop.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{stop.customer}</div>
                        <div className="text-sm text-muted-foreground">{stop.address}</div>
                      </div>
                    </div>
                    <Badge variant={stop.status === 'delivered' ? 'default' : 'outline'}>
                      {stop.status === 'delivered' ? 'Delivered' : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No active deliveries</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DriverDashboard;
