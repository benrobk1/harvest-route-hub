import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, TrendingUp, Users, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/formatMoney';
import { farmerQueries } from '@/features/farmers';
import type { CustomerZipSummary } from '@/features/farmers';
import type { Database } from '@/integrations/supabase/types';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

type OrderWithZip = Database['public']['Tables']['orders']['Row'] & {
  profiles: {
    zip_code: string;
    full_name: string;
  } | null;
  order_items?: Array<{
    product_id: string;
    products: {
      farm_profile_id: string;
      name: string;
    } | null;
  }>;
};

interface CustomerDetails {
  name: string;
  orders: number;
  revenue: number;
  avg_order: number;
  common_produce: string;
  days_between: number;
}

interface ZipDataWithCustomers extends CustomerZipSummary {
  customers?: CustomerDetails[];
  most_common_produce?: string;
  avg_days_between_orders?: number;
  avg_order_size?: number;
}

function summarizeOrdersByZip(orders: OrderWithZip[] = []): ZipDataWithCustomers[] {
  const zipMap = new Map<
    string,
    {
      order_count: number;
      total_revenue: number;
      uniqueCustomers: Set<string>;
      customerOrders: Map<string, Array<{ date: Date; amount: number; products: string[] }>>;
      allProducts: Map<string, number>;
    }
  >();

  // Build zip-level data structures
  orders.forEach(order => {
    const zip = order.profiles?.zip_code;
    if (!zip || !order.consumer_id) return;
    if (!order.created_at) return;

    const summary = zipMap.get(zip) ?? {
      order_count: 0,
      total_revenue: 0,
      uniqueCustomers: new Set<string>(),
      customerOrders: new Map(),
      allProducts: new Map(),
    };

    summary.order_count += 1;
    summary.total_revenue += Number(order.total_amount ?? 0);
    summary.uniqueCustomers.add(order.consumer_id);

    // Track customer orders
    const customerOrderList = summary.customerOrders.get(order.consumer_id) ?? [];
    const products = (order.order_items ?? [])
      .map(item => item.products?.name)
      .filter((name): name is string => !!name);
    
    customerOrderList.push({
      date: new Date(order.created_at),
      amount: Number(order.total_amount ?? 0),
      products,
    });
    summary.customerOrders.set(order.consumer_id, customerOrderList);

    // Track product frequency
    products.forEach(product => {
      summary.allProducts.set(product, (summary.allProducts.get(product) ?? 0) + 1);
    });

    zipMap.set(zip, summary);
  });

  // Calculate customer details for each zip
  return Array.from(zipMap.entries()).map(([zip, data]) => {
    const customers: CustomerDetails[] = [];
    
    data.customerOrders.forEach((orderList, consumerId) => {
      // Find consumer name from orders
      const consumerName = orders.find(o => o.consumer_id === consumerId)?.profiles?.full_name ?? 'Unknown';
      
      // Sort orders by date
      const sortedOrders = [...orderList].sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Calculate days between orders
      let totalDaysBetween = 0;
      for (let i = 1; i < sortedOrders.length; i++) {
        const daysDiff = (sortedOrders[i].date.getTime() - sortedOrders[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
        totalDaysBetween += daysDiff;
      }
      const avgDaysBetween = sortedOrders.length > 1 ? Math.round(totalDaysBetween / (sortedOrders.length - 1)) : 0;
      
      // Calculate total revenue for this customer
      const customerRevenue = orderList.reduce((sum, o) => sum + o.amount, 0);
      
      // Find most common products for this customer
      const productFreq = new Map<string, number>();
      orderList.forEach(o => {
        o.products.forEach(p => {
          productFreq.set(p, (productFreq.get(p) ?? 0) + 1);
        });
      });
      const topProducts = Array.from(productFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);
      
      customers.push({
        name: consumerName,
        orders: orderList.length,
        revenue: customerRevenue,
        avg_order: orderList.length > 0 ? customerRevenue / orderList.length : 0,
        common_produce: topProducts.join(', ') || 'N/A',
        days_between: avgDaysBetween,
      });
    });

    // Sort customers by revenue (highest first)
    customers.sort((a, b) => b.revenue - a.revenue);

    // Calculate zip-level aggregates
    const topZipProducts = Array.from(data.allProducts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    const allDaysBetween = customers
      .map(c => c.days_between)
      .filter(d => d > 0);
    const avgDaysBetweenOrders = allDaysBetween.length > 0
      ? Math.round(allDaysBetween.reduce((sum, d) => sum + d, 0) / allDaysBetween.length)
      : 0;

    return {
      zip_code: zip,
      order_count: data.order_count,
      total_revenue: data.total_revenue,
      unique_customers: data.uniqueCustomers.size,
      customers,
      most_common_produce: topZipProducts.join(', ') || 'N/A',
      avg_days_between_orders: avgDaysBetweenOrders,
      avg_order_size: data.order_count > 0 ? data.total_revenue / data.order_count : 0,
    };
  });
}

// Demo data for Milton zip code with customer details
const DEMO_ZIP_DATA = [
  {
    zip_code: '12547',
    order_count: 264,
    total_revenue: 10032,
    unique_customers: 40,
    most_common_produce: 'Tomatoes, Lettuce, Carrots',
    avg_days_between_orders: 14,
    avg_order_size: 38,
    customers: [
      { name: 'Sarah Johnson', orders: 12, revenue: 456, avg_order: 38, common_produce: 'Tomatoes, Basil', days_between: 7 },
      { name: 'Mike Chen', orders: 8, revenue: 312, avg_order: 39, common_produce: 'Lettuce, Carrots', days_between: 14 },
      { name: 'Emily Rodriguez', orders: 15, revenue: 585, avg_order: 39, common_produce: 'Tomatoes, Lettuce', days_between: 10 },
      { name: 'James Wilson', orders: 6, revenue: 228, avg_order: 38, common_produce: 'Carrots, Peppers', days_between: 21 },
      { name: 'Lisa Anderson', orders: 10, revenue: 380, avg_order: 38, common_produce: 'Tomatoes, Cucumbers', days_between: 12 },
    ]
  }
];

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
    queryKey: farmerQueries.customerAnalytics(user?.id || '', isLeadFarmer),
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
            profiles!inner(
              zip_code,
              full_name
            ),
            order_items!inner(
              product_id,
              products!inner(
                farm_profile_id,
                name
              )
            )
          `)
          .in('order_items.products.farm_profile_id', farmProfileIds)
          .eq('status', 'delivered')
          .returns<OrderWithZip[]>();

        return summarizeOrdersByZip(orders ?? []);

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
            profiles!inner(
              zip_code,
              full_name
            ),
            order_items!inner(
              product_id,
              products!inner(
                farm_profile_id,
                name
              )
            )
          `)
          .eq('order_items.products.farm_profile_id', farmProfile.id)
          .eq('status', 'delivered')
          .returns<OrderWithZip[]>();

        return summarizeOrdersByZip(orders ?? []);
      }
    },
    enabled: !!user?.id,
  });

  const displayZipData: ZipDataWithCustomers[] = zipCodeData || [];

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: farmerQueries.customerSummary(user?.id || '', displayZipData),
    queryFn: async () => {
      if (!Array.isArray(displayZipData)) {
        return { totalCustomers: 0, totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 };
      }

      const totalCustomers = displayZipData.reduce(
        (sum, zip) => sum + Number(zip.unique_customers),
        0
      );
      const totalOrders = displayZipData.reduce((sum, zip) => sum + Number(zip.order_count), 0);
      const totalRevenue = displayZipData.reduce(
        (sum, zip) => sum + Number(zip.total_revenue),
        0
      );

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
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="text-2xl font-bold">{summary?.totalCustomers || 0}</div>
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
              <div className="text-2xl font-bold">{summary?.totalOrders || 0}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(summary?.totalRevenue || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(summary?.avgOrderValue || 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Price Capture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div className="text-2xl font-bold text-green-600">90%</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">of listed price</p>
          </CardContent>
        </Card>
      </div>

      {/* ZIP Code Table */}
      <Card>
        <CardHeader>
          <CardTitle>Zip Code Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {displayZipData && Array.isArray(displayZipData) && displayZipData.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {displayZipData.map((row: ZipDataWithCustomers) => (
                <AccordionItem key={row.zip_code} value={row.zip_code} className="border rounded-lg mb-2 px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-semibold text-lg">ZIP {row.zip_code}</span>
                        <span className="text-muted-foreground text-sm">
                          {row.unique_customers} customers
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-4 space-y-3">
                      {row.customers && row.customers.length > 0 ? (
                        row.customers.map((customer: CustomerDetails, idx: number) => (
                          <div key={idx} className="bg-muted/30 rounded-lg p-4 space-y-2">
                            <div className="font-semibold text-base">{customer.name}</div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                              <div>
                                <div className="text-muted-foreground">Orders</div>
                                <div className="font-medium">{customer.orders}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Revenue</div>
                                <div className="font-medium">{formatMoney(customer.revenue)}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Avg Order</div>
                                <div className="font-medium">{formatMoney(customer.avg_order)}</div>
                              </div>
                              <div className="md:col-span-1 col-span-2">
                                <div className="text-muted-foreground">Common Produce</div>
                                <div className="font-medium">{customer.common_produce}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Time Between Orders</div>
                                <div className="font-medium">{customer.days_between} days</div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No customer details available
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
