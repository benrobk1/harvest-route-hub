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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function CustomerAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    queryKey: ['customer-zip-analytics', user?.id, isLeadFarmer],
    queryFn: async () => {
      if (isLeadFarmer) {
        // Lead farmer: show analytics for affiliated farmers
        const { data: orders } = await supabase
          .from('order_items')
          .select(`
            subtotal,
            order:orders (
              consumer_id,
              created_at,
              consumer:profiles!orders_consumer_id_fkey (
                zip_code
              )
            ),
            product:products (
              farm_profile:farm_profiles (
                farm_affiliations!farm_affiliations_farm_profile_id_fkey (
                  lead_farmer_id
                )
              )
            )
          `);

        const zipStats: Record<string, { count: number; revenue: number; customers: Set<string> }> = {};
        
        orders?.forEach((item: any) => {
          const zip = item.order?.consumer?.zip_code;
          const isAffiliated = item.product?.farm_profile?.farm_affiliations?.some(
            (fa: any) => fa.lead_farmer_id === user?.id
          );
          
          if (zip && isAffiliated) {
            if (!zipStats[zip]) {
              zipStats[zip] = { count: 0, revenue: 0, customers: new Set() };
            }
            zipStats[zip].count += 1;
            zipStats[zip].revenue += Number(item.subtotal);
            zipStats[zip].customers.add(item.order.consumer_id);
          }
        });

        return Object.entries(zipStats).map(([zip_code, stats]) => ({
          zip_code,
          order_count: stats.count,
          total_revenue: stats.revenue,
          unique_customers: stats.customers.size,
        })).sort((a, b) => b.total_revenue - a.total_revenue);
      } else {
        // Regular farmer: show analytics only for their own products
        const { data: farmProfile } = await supabase
          .from('farm_profiles')
          .select('id')
          .eq('farmer_id', user?.id)
          .single();

        if (!farmProfile) return [];

        const { data: orders } = await supabase
          .from('order_items')
          .select(`
            subtotal,
            order:orders (
              consumer_id,
              created_at,
              consumer:profiles!orders_consumer_id_fkey (
                zip_code
              )
            ),
            product:products!inner (
              farm_profile_id
            )
          `)
          .eq('product.farm_profile_id', farmProfile.id);

        const zipStats: Record<string, { count: number; revenue: number; customers: Set<string> }> = {};
        
        orders?.forEach((item: any) => {
          const zip = item.order?.consumer?.zip_code;
          
          if (zip) {
            if (!zipStats[zip]) {
              zipStats[zip] = { count: 0, revenue: 0, customers: new Set() };
            }
            zipStats[zip].count += 1;
            zipStats[zip].revenue += Number(item.subtotal);
            zipStats[zip].customers.add(item.order.consumer_id);
          }
        });

        return Object.entries(zipStats).map(([zip_code, stats]) => ({
          zip_code,
          order_count: stats.count,
          total_revenue: stats.revenue,
          unique_customers: stats.customers.size,
        })).sort((a, b) => b.total_revenue - a.total_revenue);
      }
    },
    enabled: !!user?.id && userRoles !== undefined,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['customer-summary', user?.id],
    queryFn: async () => {
      if (!Array.isArray(zipCodeData)) {
        return { totalCustomers: 0, totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
      }

      const totalCustomers = zipCodeData.reduce((sum: number, z: any) => sum + Number(z.unique_customers), 0);
      const totalOrders = zipCodeData.reduce((sum: number, z: any) => sum + Number(z.order_count), 0);
      const totalRevenue = zipCodeData.reduce((sum: number, z: any) => sum + Number(z.total_revenue), 0);

      return {
        totalCustomers,
        totalOrders,
        totalRevenue,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      };
    },
    enabled: !!zipCodeData && Array.isArray(zipCodeData),
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
          {zipCodeData && Array.isArray(zipCodeData) && zipCodeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={zipCodeData.slice(0, 10)}>
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
          {zipCodeData && Array.isArray(zipCodeData) && zipCodeData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">ZIP Code</th>
                    <th className="text-right py-2">Orders</th>
                    <th className="text-right py-2">Customers</th>
                    <th className="text-right py-2">Revenue</th>
                    <th className="text-right py-2">Avg Order</th>
                  </tr>
                </thead>
                <tbody>
                  {zipCodeData.map((row: any) => (
                    <tr key={row.zip_code} className="border-b">
                      <td className="py-2 font-mono">{row.zip_code}</td>
                      <td className="text-right py-2">{row.order_count}</td>
                      <td className="text-right py-2">{row.unique_customers}</td>
                      <td className="text-right py-2">{formatMoney(row.total_revenue)}</td>
                      <td className="text-right py-2">
                        {formatMoney(Number(row.total_revenue) / Number(row.order_count))}
                      </td>
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
