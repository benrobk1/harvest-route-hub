import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, TrendingUp, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/formatMoney";

const FarmerDashboard = () => {
  const { user } = useAuth();

  // Fetch farmer's farm profile
  const { data: farmProfile } = useQuery({
    queryKey: ['farmer-profile', user?.id],
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

  // Fetch earnings
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['farmer-earnings', farmProfile?.id],
    queryFn: async () => {
      if (!farmProfile?.id) return { today: 0, week: 0, month: 0 };

      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const monthStart = new Date(now.setDate(now.getDate() - 30)).toISOString();

      // Get orders containing farmer's products
      const { data: todayOrders } = await supabase
        .from('order_items')
        .select('subtotal, products!inner(farm_profile_id)')
        .eq('products.farm_profile_id', farmProfile.id)
        .gte('created_at', todayStart);

      const { data: weekOrders } = await supabase
        .from('order_items')
        .select('subtotal, products!inner(farm_profile_id)')
        .eq('products.farm_profile_id', farmProfile.id)
        .gte('created_at', weekStart);

      const { data: monthOrders } = await supabase
        .from('order_items')
        .select('subtotal, products!inner(farm_profile_id)')
        .eq('products.farm_profile_id', farmProfile.id)
        .gte('created_at', monthStart);

      // Farmer keeps 90% of sales
      const today = (todayOrders?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0) * 0.9;
      const week = (weekOrders?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0) * 0.9;
      const month = (monthOrders?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0) * 0.9;

      return { today, week, month };
    },
    enabled: !!farmProfile?.id,
  });

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['farmer-products', farmProfile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('farm_profile_id', farmProfile?.id)
        .order('created_at', { ascending: false });

      return data?.map(p => ({
        ...p,
        status: p.available_quantity < 10 ? 'low' : 'active'
      })) || [];
    },
    enabled: !!farmProfile?.id,
  });

  // Fetch recent orders
  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['farmer-orders', farmProfile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          subtotal,
          orders!inner(
            id,
            status,
            profiles!inner(full_name)
          ),
          products!inner(farm_profile_id, name)
        `)
        .eq('products.farm_profile_id', farmProfile?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Group by order_id
      const orderMap = new Map();
      data?.forEach(item => {
        const orderId = item.orders.id;
        if (!orderMap.has(orderId)) {
          orderMap.set(orderId, {
            id: orderId,
            customer: item.orders.profiles?.full_name || 'Unknown',
            items: 0,
            total: 0,
            status: item.orders.status,
          });
        }
        const order = orderMap.get(orderId);
        order.items += item.quantity;
        order.total += Number(item.subtotal);
      });

      return Array.from(orderMap.values()).slice(0, 5);
    },
    enabled: !!farmProfile?.id,
  });

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{farmProfile?.farm_name || 'My Farm'}</h1>
              <p className="text-sm text-muted-foreground">You keep 90% of all sales</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Earnings Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              {earningsLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.today || 0)}</div>
                  <p className="text-xs text-muted-foreground mt-1">90% goes to you</p>
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
                <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.week || 0)}</div>
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
                <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.month || 0)}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Inventory */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Product Inventory</CardTitle>
            <Button variant="outline" size="sm">Manage All</Button>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : products && products.length > 0 ? (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatMoney(Number(product.price))} per {product.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">{product.available_quantity} in stock</div>
                        <Badge variant={product.status === "low" ? "destructive" : "secondary"}>
                          {product.status === "low" ? "Low Stock" : "Active"}
                        </Badge>
                      </div>
                      <Button variant="outline" size="sm">Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No products yet. Click "Add Product" to get started.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-foreground">Order #{order.id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.customer} • {order.items} items
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-foreground">{formatMoney(order.total * 0.9)}</div>
                        <Badge variant={order.status === "delivered" ? "default" : "secondary"}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FarmerDashboard;
