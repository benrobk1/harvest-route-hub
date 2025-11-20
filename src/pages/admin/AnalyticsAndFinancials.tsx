import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/formatMoney';
import { DollarSign, TrendingUp, Users, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { adminQueries } from '@/features/admin';

const COLORS = ['#10b981', '#3b82f6'];

const AnalyticsAndFinancials = () => {
  const navigate = useNavigate();
  
  const { data, isLoading } = useQuery({
    queryKey: adminQueries.analyticsFinancials(),
    queryFn: async () => {
      // Get all profile IDs excluding demo users
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, email');
      const filterIds = allProfiles?.filter(p => !p.email.endsWith('@demo.com')).map(p => p.id) || [];

      if (filterIds.length === 0) {
        return {
          totalRevenue: 0, totalPayouts: 0, platformFees: 0, netProfit: 0, avgLTV: 0, monthlyActiveCustomers: 0,
          monthlyTrends: [], payoutBreakdown: [], cacByChannel: [], ordersCount: 0, totalCustomers: 0
        };
      }

      // Step 2: Fetch filtered data
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, acquisition_channel, created_at')
        .in('id', filterIds);
        
      const { data: orders } = await supabase
        .from('orders')
        .select('consumer_id, total_amount, created_at, status, id')
        .eq('status', 'delivered')
        .in('consumer_id', filterIds);
        
      const orderIds = orders?.map(o => o.id) || [];
      
      const { data: payouts } = await supabase
        .from('payouts')
        .select('amount, status, recipient_type, created_at, order_id')
        .in('order_id', orderIds.length > 0 ? orderIds : ['00000000-0000-0000-0000-000000000000']);
        
      const { data: fees } = await supabase
        .from('transaction_fees')
        .select('amount, fee_type, order_id')
        .in('order_id', orderIds.length > 0 ? orderIds : ['00000000-0000-0000-0000-000000000000']);

      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
      const totalPayouts = payouts?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const platformFees = fees?.filter(f => f.fee_type === 'platform').reduce((sum, f) => sum + Number(f.amount), 0) || 0;
      const netProfit = totalRevenue - totalPayouts;

      const customerLTV = new Map<string, number>();
      orders?.forEach(order => {
        const current = customerLTV.get(order.consumer_id) || 0;
        customerLTV.set(order.consumer_id, current + Number(order.total_amount));
      });
      const avgLTV = customerLTV.size > 0 ? Array.from(customerLTV.values()).reduce((sum, val) => sum + val, 0) / customerLTV.size : 0;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyActiveCustomers = new Set(orders?.filter(o => o.created_at.startsWith(currentMonth)).map(o => o.consumer_id)).size;

      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - (5 - i));
        return date.toISOString().slice(0, 7);
      });

      const monthlyTrends = last6Months.map(month => {
        const monthOrders = orders?.filter(o => o.created_at.startsWith(month)) || [];
        const revenue = monthOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const customers = new Set(monthOrders.map(o => o.consumer_id)).size;
        return { month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }), revenue, customers };
      });

      const farmerPayouts = payouts?.filter(p => p.recipient_type === 'farmer').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const driverPayouts = payouts?.filter(p => p.recipient_type === 'driver').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      const channelStats = new Map<string, { users: number; totalSpend: number }>();
      profiles?.forEach(profile => {
        const channel = profile.acquisition_channel || 'organic';
        const userLTV = customerLTV.get(profile.id) || 0;
        const current = channelStats.get(channel) || { users: 0, totalSpend: 0 };
        channelStats.set(channel, { users: current.users + 1, totalSpend: current.totalSpend + userLTV });
      });

      const cacByChannel = Array.from(channelStats.entries()).map(([channel, stats]) => ({
        channel,
        users: stats.users,
        avgValue: stats.users > 0 ? stats.totalSpend / stats.users : 0,
      }));

      return {
        totalRevenue, totalPayouts, platformFees, netProfit, avgLTV, monthlyActiveCustomers,
        monthlyTrends, payoutBreakdown: [{ name: 'Farmers', value: farmerPayouts }, { name: 'Drivers', value: driverPayouts }],
        cacByChannel, ordersCount: orders?.length || 0, totalCustomers: customerLTV.size
      };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Analytics & Financial Reports</h1>
          <p className="text-muted-foreground">Comprehensive business metrics and financial health</p>
        </div>
      </div>
      
      <Tabs defaultValue="financial">
        <TabsList><TabsTrigger value="financial">Financial Overview</TabsTrigger><TabsTrigger value="customers">Customer Analytics</TabsTrigger></TabsList>
        
        <TabsContent value="financial" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(data?.totalRevenue || 0)}</div><p className="text-xs text-muted-foreground">{data?.ordersCount || 0} orders</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Payouts</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(data?.totalPayouts || 0)}</div><p className="text-xs text-muted-foreground">To farmers & drivers</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Platform Fees</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(data?.platformFees || 0)}</div><p className="text-xs text-muted-foreground">Commission</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Net Profit</CardTitle><DollarSign className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatMoney(data?.netProfit || 0)}</div><p className="text-xs text-muted-foreground">After payouts</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Orders Completed</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{data?.ordersCount || 0}</div><p className="text-xs text-muted-foreground">All time</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Avg Order Value</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(data?.ordersCount ? (data.totalRevenue / data.ordersCount) : 0)}</div><p className="text-xs text-muted-foreground">Per order</p></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Monthly Revenue Trends</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={350}><LineChart data={data?.monthlyTrends || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(value) => formatMoney(Number(value))} /><Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle>Payout Distribution</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data?.payoutBreakdown || []} cx="50%" cy="50%" label={({ name, value }) => `${name}: ${formatMoney(value)}`} outerRadius={100} dataKey="value">{data?.payoutBreakdown?.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value))} /></PieChart></ResponsiveContainer></CardContent></Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Avg Customer LTV</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatMoney(data?.avgLTV || 0)}</div><p className="text-xs text-muted-foreground">{data?.totalCustomers || 0} customers</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Monthly Active</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{data?.monthlyActiveCustomers || 0}</div><p className="text-xs text-muted-foreground">This month</p></CardContent></Card>
          </div>
          <Card><CardHeader><CardTitle>Customer Growth</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={350}><LineChart data={data?.monthlyTrends || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Line yAxisId="left" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" /><Line yAxisId="right" type="monotone" dataKey="customers" stroke="hsl(var(--earth))" strokeWidth={2} name="Customers" /></LineChart></ResponsiveContainer></CardContent></Card>
          <Card><CardHeader><CardTitle>Acquisition by Channel</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={300}><BarChart data={data?.cacByChannel || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="channel" /><YAxis /><Tooltip formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="avgValue" fill="hsl(var(--primary))" name="Avg Customer Value" /></BarChart></ResponsiveContainer></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsAndFinancials;
