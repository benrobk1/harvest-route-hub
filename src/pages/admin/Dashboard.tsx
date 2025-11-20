import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Truck, Sprout, DollarSign, TrendingUp, MapPin, FileText, Database, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { KPIHeader, adminQueries } from "@/features/admin";

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading, refetch } = useQuery({
    queryKey: adminQueries.metrics(),
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

      // Count pending approvals
      const { count: pendingApprovals } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approval_status', 'pending');

      return {
        consumers: consumers || 0,
        drivers: drivers || 0,
        farmers: farmers || 0,
        revenue,
        activeDeliveries: activeDeliveries || 0,
        pendingApprovals: pendingApprovals || 0,
      };
    },
  });

  // Fetch active drivers
  const { data: liveDrivers, isLoading: driversLoading } = useQuery({
    queryKey: adminQueries.liveDrivers(),
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
        deliveries: `${(batch.batch_stops ?? []).filter((stop) => stop.status === 'delivered').length}/${batch.batch_stops?.length || 0}`,
        status: batch.status,
      })) || [];
    },
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: adminQueries.recentActivity(),
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Management Portal</h1>
              <p className="text-sm text-muted-foreground">Real-time business intelligence and operations</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-6 lg:grid-cols-12 mt-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/approvals')}>Approvals</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/user-search')}>User Search</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/products')}>Products</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/disputes')}>Disputes</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/market-config')}>Markets</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/batches')}>Batches</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/analytics-financials')}>Analytics</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/audit-log')}>Audit Log</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/farm-affiliations')}>Affiliations</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/tax-documents')}>Tax Docs</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/roles')}>Admins</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/credits')}>Credits</Button>
            </div>
        </div>
      </header>

      {/* KPI Header - Live Business Metrics */}
      <KPIHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Pending Approvals - Single Card */}
        <Link to="/admin/approvals">
          <Card className="border-2 hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? <Skeleton className="h-8 w-full" /> : (
                <div className="text-3xl font-bold">{metrics?.pendingApprovals || 0}</div>
              )}
              <p className="text-sm text-muted-foreground mt-2">Users awaiting approval</p>
              <Button size="sm" variant="outline" className="mt-4">
                Review Approvals
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* Live Delivery Tracking */}
        <Card className="border-2 hover:shadow-md transition-shadow">
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
        </div>

      </main>
    </div>
  );
};

export default AdminDashboard;
