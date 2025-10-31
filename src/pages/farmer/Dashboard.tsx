import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, TrendingUp, Plus, Pencil, Trash2, FileSpreadsheet, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/formatMoney";
import { ProductForm } from "@/components/farmer/ProductForm";
import { BatchConsolidation } from "@/components/farmer/BatchConsolidation";
import { StripeConnectSimple } from "@/components/farmer/StripeConnectSimple";
import { BulkEditDialog } from "@/components/farmer/BulkEditDialog";
import { MultiFarmDashboard } from "@/components/farmer/MultiFarmDashboard";
import { WeeklyInventoryReview } from "@/components/farmer/WeeklyInventoryReview";
import { LeadFarmerInfoCard } from "@/components/farmer/LeadFarmerInfoCard";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FarmerDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Fetch farmer's farm profile and check if lead farmer
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

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);
      return data?.map(r => r.role) || [];
    },
    enabled: !!user?.id,
  });

  const isLeadFarmer = userRoles?.includes('lead_farmer');

  // Fetch user profile for collection point lead farmer
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('collection_point_lead_farmer_id')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id && !isLeadFarmer,
  });

  // Fetch earnings (including lead farmer commission if applicable)
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['farmer-earnings', farmProfile?.id, user?.id],
    queryFn: async () => {
      if (!farmProfile?.id) return { today: 0, week: 0, month: 0, commission: { today: 0, week: 0, month: 0 } };

      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const monthStart = new Date(now.setDate(now.getDate() - 30)).toISOString();

      // Get orders containing farmer's products (direct sales)
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

      // Farmer keeps 88% of sales (2% goes to lead farmer coordination, 10% to platform)
      // All farmers are affiliated with lead farmers
      const today = (todayOrders?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0) * 0.88;
      const week = (weekOrders?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0) * 0.88;
      const month = (monthOrders?.reduce((sum, item) => sum + Number(item.subtotal), 0) || 0) * 0.88;

      // Get lead farmer commission if applicable
      const { data: todayCommission } = await supabase
        .from('payouts')
        .select('amount')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'lead_farmer_commission')
        .gte('created_at', todayStart);

      const { data: weekCommission } = await supabase
        .from('payouts')
        .select('amount')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'lead_farmer_commission')
        .gte('created_at', weekStart);

      const { data: monthCommission } = await supabase
        .from('payouts')
        .select('amount')
        .eq('recipient_id', user?.id)
        .eq('recipient_type', 'lead_farmer_commission')
        .gte('created_at', monthStart);

      const commission = {
        today: todayCommission?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        week: weekCommission?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
        month: monthCommission?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
      };

      return { today, week, month, commission };
    },
    enabled: !!farmProfile?.id && !!user?.id,
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

  // Create product mutation
  const createProduct = useMutation({
    mutationFn: async (productData: any) => {
      const { error } = await supabase.from("products").insert({
        ...productData,
        price: parseFloat(productData.price),
        available_quantity: parseInt(productData.available_quantity),
        farm_profile_id: farmProfile?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmer-products"] });
      toast.success("Product added successfully");
    },
    onError: () => {
      toast.error("Failed to add product");
    },
  });

  // Update product mutation
  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("products")
        .update({
          ...data,
          price: parseFloat(data.price),
          available_quantity: parseInt(data.available_quantity),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmer-products"] });
      toast.success("Product updated successfully");
      setEditingProduct(null);
    },
    onError: () => {
      toast.error("Failed to update product");
    },
  });

  // Delete product mutation
  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["farmer-products"] });
      toast.success("Product deleted successfully");
      setDeletingProductId(null);
    },
    onError: () => {
      toast.error("Failed to delete product");
    },
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.location.href = '/farmer/profile'}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </Button>
            <StripeConnectSimple variant="button" />
            {isLeadFarmer && (
              <>
                <Button variant="outline" onClick={() => window.location.href = '/farmer/customer-analytics'}>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
                <Button variant="outline" onClick={() => window.location.href = '/farmer/affiliated-farmers'}>
                  <User className="h-4 w-4 mr-2" />
                  Affiliated Farmers
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setIsBulkEditOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Bulk Import/Edit
            </Button>
            <Button onClick={() => setIsAddingProduct(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stripe Connect Status Banner */}
        <StripeConnectSimple variant="banner" />

        {/* Weekly Inventory Review */}
        {farmProfile?.id && <WeeklyInventoryReview farmProfileId={farmProfile.id} />}

        {/* Multi-Farm Dashboard for Lead Farmers */}
        {isLeadFarmer && <MultiFarmDashboard />}

        {/* Lead Farmer Batch Consolidation */}
        {isLeadFarmer && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Batch Consolidation</h2>
            <BatchConsolidation />
          </div>
        )}

        {/* Lead Farmer Info Card for Regular Farmers */}
        {!isLeadFarmer && userProfile?.collection_point_lead_farmer_id && (
          <LeadFarmerInfoCard leadFarmerId={userProfile.collection_point_lead_farmer_id} />
        )}

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
                  <p className="text-xs text-muted-foreground mt-1">
                    90% of sales{earnings?.commission.today ? ` + ${formatMoney(earnings.commission.today)} commission` : ''}
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
                  <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.week || 0)}</div>
                  {earnings?.commission.week > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Includes {formatMoney(earnings.commission.week)} lead farmer commission
                    </p>
                  )}
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
                  <div className="text-3xl font-bold text-foreground">{formatMoney(earnings?.month || 0)}</div>
                  {earnings?.commission.month > 0 && (
                    <p className="text-xs text-success mt-1">
                      + {formatMoney(earnings.commission.month)} commission earnings
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Product Inventory */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Product Inventory</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/farmer/inventory'}
            >
              Manage All
            </Button>
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
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingProduct(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingProductId(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <ProductForm
        open={isAddingProduct}
        onOpenChange={setIsAddingProduct}
        onSubmit={async (data) => {
          await createProduct.mutateAsync(data);
        }}
      />

      <ProductForm
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        onSubmit={async (data) => {
          await updateProduct.mutateAsync({ id: editingProduct.id, data });
        }}
        defaultValues={
          editingProduct
            ? {
                name: editingProduct.name,
                description: editingProduct.description || "",
                price: editingProduct.price.toString(),
                unit: editingProduct.unit,
                available_quantity: editingProduct.available_quantity.toString(),
                image_url: editingProduct.image_url || "",
              }
            : undefined
        }
        isEdit
      />

      <AlertDialog open={!!deletingProductId} onOpenChange={(open) => !open && setDeletingProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingProductId && deleteProduct.mutate(deletingProductId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FarmerDashboard;
