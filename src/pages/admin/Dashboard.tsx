import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Truck, Sprout, DollarSign, TrendingUp, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const AdminDashboard = () => {
  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      // Count consumers
      const { count: consumers } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'consumer');

      // Count drivers
      const { count: drivers } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'driver');

      // Count farmers
      const { count: farmers } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .in('role', ['farmer', 'lead_farmer']);

      // Get revenue from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', thirtyDaysAgo.toISOString());

      const revenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;

      // Count active deliveries
      const { count: activeDeliveries } = await supabase
        .from('delivery_batches')
        .select('*', { count: 'exact', head: true })
        .in('status', ['assigned', 'in_progress']);

      return {
        consumers: consumers || 0,
        drivers: drivers || 0,
        farmers: farmers || 0,
        revenue,
        activeDeliveries: activeDeliveries || 0,
      };
    },
  });

  // Fetch active drivers
  const { data: liveDrivers, isLoading: driversLoading } = useQuery({
    queryKey: ['live-drivers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          batch_number,
          status,
          profiles!delivery_batches_driver_id_fkey (
            full_name
          ),
          batch_stops (
            id,
            status
          )
        `)
        .in('status', ['assigned', 'in_progress'])
        .limit(5);

      return data?.map(batch => ({
        id: batch.id,
        name: batch.profiles?.full_name || 'Unknown Driver',
        route: `Batch #${batch.batch_number}`,
        deliveries: `${batch.batch_stops?.filter((s: any) => s.status === 'delivered').length || 0}/${batch.batch_stops?.length || 0}`,
        status: batch.status,
      })) || [];
    },
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, profiles!orders_consumer_id_fkey (delivery_address)')
        .order('created_at', { ascending: false })
        .limit(3);

      return orders?.map(order => ({
        id: order.id,
        type: 'order',
        text: `New order from ${order.profiles?.delivery_address?.split(',').pop()?.trim() || 'Unknown ZIP'}`,
        time: formatDistanceToNow(new Date(order.created_at), { addSuffix: true }),
        status: 'new',
      })) || [];
    },
  });

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Management Portal</h1>
          <p className="text-sm text-muted-foreground">Real-time business intelligence and operations</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Consumers
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{metrics?.consumers || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Delivery Drivers
              </CardTitle>
              <Truck className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">{metrics?.drivers || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">{metrics?.activeDeliveries || 0} active now</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Partner Farms
              </CardTitle>
              <Sprout className="h-4 w-4 text-earth" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{metrics?.farmers || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue (30d)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold text-foreground">${metrics?.revenue.toFixed(2) || '0.00'}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Delivery Tracking */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Live Delivery Tracking</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {metrics?.activeDeliveries || 0} drivers currently on route
              </p>
            </div>
            <Badge variant="default" className="bg-success">
              <MapPin className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            {driversLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : liveDrivers && liveDrivers.length > 0 ? (
              <div className="space-y-4">
                {liveDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{driver.name}</div>
                      <div className="text-sm text-muted-foreground">{driver.route}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {driver.deliveries} completed
                        </div>
                        <Badge variant="default" className="bg-success">Active</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No active deliveries</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{activity.text}</div>
                        <div className="text-xs text-muted-foreground mt-1">{activity.time}</div>
                      </div>
                      <Badge variant={activity.status === "new" ? "default" : "secondary"}>
                        {activity.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Business Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Customer LTV</div>
                  <div className="text-2xl font-bold text-foreground">$428</div>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Avg Order Value</div>
                  <div className="text-2xl font-bold text-foreground">$46.32</div>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Monthly Churn</div>
                  <div className="text-2xl font-bold text-foreground">2.8%</div>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
