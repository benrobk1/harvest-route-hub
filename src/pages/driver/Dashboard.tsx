import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Package, TrendingUp, Star, Navigation, Clock, MapPin, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/formatMoney";
import { Progress } from "@/components/ui/progress";
import { getRatingDisplay, MINIMUM_REVIEWS_THRESHOLD } from "@/lib/ratingHelpers";
import { StripeConnectStatusBanner } from "@/components/StripeConnectStatusBanner";
import { calculateEstimatedExpenses } from "@/lib/driverEarningsHelpers";
import { FLAT_DELIVERY_FEE } from "@/lib/deliveryFeeHelpers";
import { RouteDensityMap, driverQueries } from "@/features/drivers";
import { IssueReporter } from "@/features/drivers/components/IssueReporter";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type DriverBatchStopSecure = Database["public"]["Views"]["driver_batch_stops_secure"]["Row"];
type DriverActiveBatch = {
  id: string;
  driver_batch_stops_secure: DriverBatchStopSecure[] | null;
};

type OrderNameLookup = {
  id: string;
  profiles: { full_name: string | null } | null;
};




type ActiveRouteStop = {
  id: string;
  customer: string;
  address: string | null;
  status: string | null;
  addressVisible: boolean;
  isCollectionPoint: boolean;
};

const DriverDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch earnings from delivery fees and tips
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: driverQueries.earnings(user?.id || ''),
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
  // Use privacy-protecting driver_batch_stops_secure view to prevent premature address exposure
  const { data: activeRoute, isLoading: routeLoading } = useQuery({
    queryKey: driverQueries.activeRoute(user?.id || ''),
    queryFn: async () => {
      // Query secure view - addresses masked until address_visible_at is set
      const { data: batch } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          driver_batch_stops_secure!inner (
            id,
            address,
            street_address,
            city,
            state,
            status,
            sequence_number,
            address_visible_at,
            order_id
          )
        `)
        .returns<DriverActiveBatch>()
        .eq('driver_id', user?.id)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!batch) return [];

      // Get customer names separately (not in secure view)
      const orderIds = (batch.driver_batch_stops_secure ?? [])
        .map(stop => stop.order_id)
        .filter((id): id is string => Boolean(id));
      const { data: orders } = await supabase
        .from('orders')
        .select('id, profiles!inner(full_name)')
        .in('id', orderIds)
        .returns<OrderNameLookup[]>();

      const orderMap = new Map(orders?.map(o => [o.id, o.profiles?.full_name]) || []);

      return batch.driver_batch_stops_secure
        ?.sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0))
        .map<ActiveRouteStop>((stop) => ({
          id: stop.id ?? '',
          customer: orderMap.get(stop.order_id) || 'Unknown',
          // Address already masked by secure view if not visible
          address: stop.street_address || stop.address,
          status: stop.status,
          addressVisible: !!stop.address_visible_at,
          isCollectionPoint: stop.status === 'collection_point',
        })) || [];
    },
    enabled: !!user?.id,
  });

  // Fetch stats and ratings
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: driverQueries.stats(user?.id || ''),
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayStops } = await supabase
        .from('driver_batch_stops_secure')
        .select('id, status, delivery_batch_id')
        .gte('created_at', todayStart.toISOString());

      const deliveredToday = todayStops?.filter(s => s.status === 'delivered').length || 0;

      // Get actual driver rating
      const { data: ratings } = await supabase
        .from('delivery_ratings')
        .select('rating')
        .eq('driver_id', user?.id);

      const avgRating = ratings && ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      const totalRatings = ratings?.length || 0;

      // Calculate on-time percentage from completed stops
      const { data: completedStops } = await supabase
        .from('driver_batch_stops_secure')
        .select('estimated_arrival, actual_arrival')
        .eq('status', 'delivered')
        .not('actual_arrival', 'is', null)
        .limit(100);

      let onTimeCount = 0;
      if (completedStops && completedStops.length > 0) {
        completedStops.forEach(stop => {
          if (stop.estimated_arrival && stop.actual_arrival) {
            const estimated = new Date(stop.estimated_arrival).getTime();
            const actual = new Date(stop.actual_arrival).getTime();
            // On time if delivered within 15 minutes of estimate
            if (actual <= estimated + 15 * 60 * 1000) {
              onTimeCount++;
            }
          }
        });
      }

      const onTimePercentage = completedStops && completedStops.length > 0
        ? Math.round((onTimeCount / completedStops.length) * 100)
        : 100;

      return {
        deliveries: deliveredToday,
        rating: avgRating.toFixed(1),
        totalRatings,
        onTime: onTimePercentage,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch active batch ID for route density map
  const { data: activeBatch } = useQuery({
    queryKey: driverQueries.activeBatch(user?.id || ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_batches')
        .select('id')
        .eq('driver_id', user?.id)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch monthly completed batches count
  const { data: monthlyBatches } = useQuery({
    queryKey: driverQueries.monthlyBatches(user?.id || ''),
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(monthStart.getDate() - 30);

      const { count } = await supabase
        .from('delivery_batches')
        .select('id', { count: 'exact' })
        .eq('driver_id', user?.id)
        .eq('status', 'completed')
        .gte('created_at', monthStart.toISOString());
      
      return count || 0;
    },
    enabled: !!user?.id,
  });


  // Derived display values for Today's Earnings (use fallback estimates when no real payouts today)
  const activeStopsCount = activeRoute?.filter((r) => !r.isCollectionPoint).length || 0;
  const usingFallbackToday = (earnings?.today.total || 0) === 0 && activeStopsCount > 0;
  const todayGross = usingFallbackToday ? activeStopsCount * FLAT_DELIVERY_FEE : (earnings?.today.total || 0);
  const todayTips = usingFallbackToday ? Math.round(activeStopsCount * FLAT_DELIVERY_FEE * 0.05) : (earnings?.today.tips || 0);
  const todayDeliveryFees = todayGross - todayTips;
  const expenseStops = usingFallbackToday ? activeStopsCount : (stats?.deliveries || 0);
  const todayExpenses = calculateEstimatedExpenses(expenseStops);

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Driver Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back! You have {stats?.deliveries || 0} deliveries today
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/driver/payouts')}>
                <DollarSign className="h-4 w-4 mr-2" />
                Payouts
              </Button>
              <Button variant="outline" onClick={() => navigate('/driver/tax-info')}>
                <FileText className="h-4 w-4 mr-2" />
                Tax Info
              </Button>
              <Button onClick={() => navigate('/driver/profile')}>
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stripe Connect Status Banner */}
        <StripeConnectStatusBanner />

        {/* Route Navigation Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/driver/available-routes')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Available Routes
              </CardTitle>
              <CardDescription>Browse and claim delivery batches</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                View upcoming delivery batches and claim routes that fit your schedule
              </p>
              <Button className="w-full">
                Browse Routes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/driver/active-route')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-success" />
                Active Route
              </CardTitle>
              <CardDescription>
                {activeRoute && activeRoute.length > 0 ? 'In progress' : 'No active route'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {routeLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : activeRoute && activeRoute.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Next Stop</p>
                      <p className="font-semibold">{activeRoute[0].customer}</p>
                    </div>
                    <Badge variant="secondary">{activeRoute.length} stops</Badge>
                  </div>
                  <Button className="w-full" variant="default">
                    <Navigation className="h-4 w-4 mr-2" />
                    Start Deliveries
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Claim a route from available batches to start deliveries
                  </p>
                  <Button className="w-full" variant="outline" disabled>
                    No Active Route
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Route Density Map - Show if there's an active batch */}
        {activeBatch?.id ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Route Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your route starts at 2:30 PM. Head to the collection point to pick up and scan orders, then follow GPS tracking for deliveries.
              </p>
              <RouteDensityMap batchId={activeBatch.id} />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Route Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                Route overview remains blank until you claim and activate a route. Check Available Routes to get started.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Issue Reporter - Only show if driver has an active batch */}
        {activeBatch?.id && (
          <IssueReporter batchId={activeBatch.id} />
        )}

        {/* Earnings Overview with Expense Breakdown */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Today's Earnings Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your net earnings after estimated expenses
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Gross Earnings</div>
                <div className="text-2xl font-bold text-foreground">
                  {formatMoney(todayGross)}
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Delivery Fees:</span>
                    <span>{formatMoney(todayDeliveryFees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tips:</span>
                    <span className="text-green-600">{formatMoney(todayTips)}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 border-l pl-4">
                <div className="text-sm text-muted-foreground">Estimated Expenses</div>
                <div className="text-2xl font-bold text-destructive">
                  -{formatMoney(todayExpenses.total)}
                </div>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Fuel (est.):</span>
                    <span>-{formatMoney(todayExpenses.fuel)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tolls (est.):</span>
                    <span>-{formatMoney(todayExpenses.tolls)}</span>
                  </div>
                  <div className="text-[10px] mt-2 italic">
                    Based on {expenseStops} stops, avg 30mi route
                  </div>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Net Payout (Est.)</div>
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {formatMoney(Math.max(0, todayGross - todayExpenses.total))}
              </div>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
        </Card>

        {/* Weekly and Monthly Earnings */}
        <div className="grid gap-6 md:grid-cols-2">
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
                  <div className="text-3xl font-bold text-foreground">{formatMoney((earnings?.month.total || 0) + (earnings?.month.tips || 0))}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {monthlyBatches || 0} deliveries | {formatMoney(earnings?.month.tips || 0)} tips
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                    <Star className="h-6 w-6 text-warning" />
                  </div>
                  <div className="flex-1">
                    {(() => {
                      const ratingDisplay = getRatingDisplay(
                        Number(stats?.rating || 0), 
                        stats?.totalRatings || 0
                      );
                      
                      return ratingDisplay.show ? (
                        <>
                          <div className="text-2xl font-bold text-foreground">
                            {ratingDisplay.rating}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Rating ({ratingDisplay.reviewCount} reviews)
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-xl font-bold text-foreground">
                            Building reputation
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {ratingDisplay.progress} reviews needed
                          </div>
                          <Progress 
                            value={(ratingDisplay.reviewCount / MINIMUM_REVIEWS_THRESHOLD) * 100} 
                            className="h-2"
                          />
                        </>
                      );
                    })()}
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
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default DriverDashboard;
