import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/formatMoney';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useDemoMode } from '@/contexts/DemoModeContext';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

// Demo data for Brooklyn zip code
const DEMO_ZIP_DATA = [
  {
    zip_code: '11201',
    order_count: 264,
    total_revenue: 10032,
    unique_customers: 40,
    most_common_produce: 'Tomatoes, Lettuce, Carrots',
    avg_days_between_orders: 14,
    avg_order_size: 38
  }
];

export default function CustomerAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isDemoMode } = useDemoMode();

  // Check if user is a lead farmer
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);
      return data;
    },
    enabled: !!user?.id,
  });

  const isLeadFarmer = userRoles?.some(r => r.role === 'lead_farmer');

  const { data: zipCodeData, isLoading: zipLoading } = useQuery({
    queryKey: ['customer-analytics-zip', user?.id, isLeadFarmer],
    queryFn: async () => {
      if (isLeadFarmer) {
        // For lead farmers, get aggregated data from affiliated farms
        const { data: affiliations } = await supabase
          .from('farm_affiliations')
          .select('farm_profile_id')
          .eq('lead_farmer_id', user?.id)
          .eq('active', true);

        if (!affiliations?.length) return [];

        const farmProfileIds = affiliations.map(a => a.farm_profile_id);

        const { data: orders } = await supabase
          .from('orders')
          .select(`
            id,
            consumer_id,
            total_amount,
            created_at,
            profiles!inner(zip_code),
            order_items!inner(
              product_id,
              products!inner(
                farm_profile_id
              )
            )
          `)
          .in('order_items.products.farm_profile_id', farmProfileIds)
          .eq('status', 'delivered');

        if (!orders?.length) return [];

        // Aggregate by zip code
        const zipMap = new Map();
        orders.forEach(order => {
          const zip = order.profiles?.zip_code;
          if (!zip) return;

          if (!zipMap.has(zip)) {
            zipMap.set(zip, {
              zip_code: zip,
              order_count: 0,
              total_revenue: 0,
              unique_customers: new Set(),
            });
          }

          const zipData = zipMap.get(zip);
          zipData.order_count++;
          zipData.total_revenue += Number(order.total_amount);
          zipData.unique_customers.add(order.consumer_id);
        });

        return Array.from(zipMap.values()).map(data => ({
          zip_code: data.zip_code,
          order_count: data.order_count,
          total_revenue: data.total_revenue,
          unique_customers: data.unique_customers.size,
        }));

      } else {
        // For regular farmers, get their own farm's data
        const { data: farmProfile } = await supabase
          .from('farm_profiles')
          .select('id')
          .eq('farmer_id', user?.id)
          .single();

        if (!farmProfile) return [];

        const { data: orders } = await supabase
          .from('orders')
          .select(`
            id,
            consumer_id,
            total_amount,
            created_at,
            profiles!inner(zip_code),
            order_items!inner(
              product_id,
              products!inner(
                farm_profile_id
              )
            )
          `)
          .eq('order_items.products.farm_profile_id', farmProfile.id)
          .eq('status', 'delivered');

        if (!orders?.length) return [];

        // Aggregate by zip code
        const zipMap = new Map();
        orders.forEach(order => {
          const zip = order.profiles?.zip_code;
          if (!zip) return;

          if (!zipMap.has(zip)) {
            zipMap.set(zip, {
              zip_code: zip,
              order_count: 0,
              total_revenue: 0,
              unique_customers: new Set(),
            });
          }

          const zipData = zipMap.get(zip);
          zipData.order_count++;
          zipData.total_revenue += Number(order.total_amount);
          zipData.unique_customers.add(order.consumer_id);
        });

        return Array.from(zipMap.values()).map(data => ({
          zip_code: data.zip_code,
          order_count: data.order_count,
          total_revenue: data.total_revenue,
          unique_customers: data.unique_customers.size,
        }));
      }
    },
    enabled: !!user?.id,
  });

  // Use demo data if in demo mode and no real data
  const displayZipData = isDemoMode && (!zipCodeData || zipCodeData.length === 0) 
    ? DEMO_ZIP_DATA 
    : zipCodeData || [];

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['customer-summary', user?.id, displayZipData],
    queryFn: async () => {
      if (!Array.isArray(displayZipData)) {
        return { totalCustomers: 0, totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
      }

      const totalCustomers = displayZipData.reduce((sum: number, z: any) => sum + Number(z.unique_customers), 0);
      const totalOrders = displayZipData.reduce((sum: number, z: any) => sum + Number(z.order_count), 0);
      const totalRevenue = displayZipData.reduce((sum: number, z: any) => sum + Number(z.total_revenue), 0);

      return {
        totalCustomers,
        totalOrders,
        totalRevenue,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      };
    },
    enabled: !!displayZipData && Array.isArray(displayZipData),
  });

  if (zipLoading || summaryLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => navigate('/farmer/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold mt-2">Customer Analytics</h1>
          <p className="text-muted-foreground">Insights into your customer base and ordering patterns</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-3xl font-bold">{summary?.totalCustomers || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="text-3xl font-bold">{summary?.totalOrders || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(summary?.totalRevenue || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatMoney(summary?.avgOrderValue || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* ZIP Code Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Orders by ZIP Code
          </CardTitle>
          <CardDescription>Revenue and order distribution across customer locations</CardDescription>
        </CardHeader>
        <CardContent>
          {displayZipData && Array.isArray(displayZipData) && displayZipData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={displayZipData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="zip_code" />
                <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--secondary))" />
                <Tooltip 
                  formatter={(value: any) => {
                    if (typeof value === 'number' && value > 100) {
                      return formatMoney(value);
                    }
                    return value;
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="order_count" fill="hsl(var(--primary))" name="Orders" />
                <Bar yAxisId="right" dataKey="total_revenue" fill="hsl(var(--secondary))" name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No order data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZIP Code Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed ZIP Code Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {displayZipData && Array.isArray(displayZipData) && displayZipData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">ZIP Code</th>
                    <th className="text-right py-2">Customers</th>
                    <th className="text-right py-2">Orders</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Avg Order</th>
                    {isDemoMode && displayZipData.some((d: any) => d.most_common_produce) && (
                      <>
                        <th className="text-left py-2">Common Produce</th>
                        <th className="text-right py-2">Time Between Orders</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayZipData.map((row: any) => (
                    <tr key={row.zip_code} className="border-b">
                      <td className="py-2 font-mono">{row.zip_code}</td>
                      <td className="text-right py-2">{row.unique_customers}</td>
                      <td className="text-right py-2">{row.order_count}</td>
                      <td className="text-right py-2">{formatMoney(row.total_revenue)}</td>
                      <td className="text-right py-2">
                        {formatMoney(Number(row.total_revenue) / Number(row.order_count))}
                      </td>
                      {isDemoMode && row.most_common_produce && (
                        <>
                          <td className="text-left py-2">{row.most_common_produce}</td>
                          <td className="text-right py-2">{row.avg_days_between_orders} days</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No customer data available yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
