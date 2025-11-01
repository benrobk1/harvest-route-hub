import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatMoney } from '@/lib/formatMoney';
import { DollarSign, Package, TrendingUp, Users, FileText, Boxes } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { StripeConnectSimple } from '@/components/farmer/StripeConnectSimple';
import { WeeklyInventoryReview } from '@/components/farmer/WeeklyInventoryReview';
import { LeadFarmerInfoCard } from '@/components/farmer/LeadFarmerInfoCard';
import { MultiFarmDashboard } from '@/components/farmer/MultiFarmDashboard';
import { BatchConsolidation } from '@/components/farmer/BatchConsolidation';
import { NextOrderCutoffCard } from '@/components/farmer/NextOrderCutoffCard';

export default function FarmerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: farmProfile, isLoading: farmLoading } = useQuery({
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

  const { data: userRoles, isLoading: rolesLoading } = useQuery({
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

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('collection_point_lead_farmer_id, zip_code')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id && !isLeadFarmer,
  });

  const collectionPointLeadFarmerId = userProfile?.collection_point_lead_farmer_id;

  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['farmer-earnings', farmProfile?.id],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          order_items!inner(
            subtotal,
            products!inner(farm_profile_id)
          )
        `)
        .eq('order_items.products.farm_profile_id', farmProfile?.id)
        .eq('status', 'delivered');

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const today = orders
        ?.filter((o) => new Date(o.created_at) >= todayStart)
        .reduce((sum, o) => sum + o.order_items.reduce((s, i) => s + Number(i.subtotal), 0), 0) || 0;

      return { today };
    },
    enabled: !!farmProfile?.id,
  });

  const { data: productCount } = useQuery({
    queryKey: ['product-count', farmProfile?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('farm_profile_id', farmProfile?.id);
      return count || 0;
    },
    enabled: !!farmProfile?.id,
  });

  const { data: pendingOrdersCount } = useQuery({
    queryKey: ['pending-orders-count', farmProfile?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('orders')
        .select('order_items!inner(products!inner(farm_profile_id))', { count: 'exact', head: true })
        .eq('order_items.products.farm_profile_id', farmProfile?.id)
        .in('status', ['pending', 'confirmed']);
      return count || 0;
    },
    enabled: !!farmProfile?.id,
  });

  if (profileLoading || rolesLoading || farmLoading || earningsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{farmProfile?.farm_name || 'Farm Dashboard'}</h1>
          <StripeConnectSimple />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/farmer/profile')}>
            Profile
          </Button>
          <Button variant="outline" onClick={() => navigate('/farmer/customer-analytics')}>
            Analytics
          </Button>
          {isLeadFarmer && (
            <Button variant="outline" onClick={() => navigate('/farmer/affiliated-farmers')}>
              <Users className="mr-2 h-4 w-4" />
              Affiliated Farmers
            </Button>
          )}
          {!isLeadFarmer && collectionPointLeadFarmerId && (
            <Button variant="outline" onClick={() => navigate('/farmer/my-lead-farmer')}>
              Your Collection Point
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/farmer/inventory')}>
            <Boxes className="mr-2 h-4 w-4" />
            Manage Inventory
          </Button>
          <Button onClick={() => navigate('/farmer/financials')}>
            <FileText className="mr-2 h-4 w-4" />
            Financials
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(earnings?.today || 0)}</div>
            <p className="text-xs text-muted-foreground">From delivered orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/farmer/inventory')}>
                Manage inventory →
              </Button>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrdersCount || 0}</div>
            <p className="text-xs text-muted-foreground">Orders to fulfill</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Order Cutoff */}
      {userProfile?.zip_code && (
        <NextOrderCutoffCard zipCode={userProfile.zip_code} />
      )}

      {/* Weekly Inventory Review Card */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Inventory Review</CardTitle>
          <CardDescription>Keep your inventory up to date</CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyInventoryReview farmProfileId={farmProfile?.id || ''} />
          <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/farmer/inventory')}>
            View All Products
          </Button>
        </CardContent>
      </Card>

      {/* Multi-Farm Dashboard for Lead Farmers */}
      {isLeadFarmer && <MultiFarmDashboard />}

      {/* Batch Consolidation for Lead Farmers */}
      {isLeadFarmer && <BatchConsolidation />}

      {/* Lead Farmer Info Card for Regular Farmers */}
      {!isLeadFarmer && collectionPointLeadFarmerId && (
        <LeadFarmerInfoCard leadFarmerId={collectionPointLeadFarmerId} />
      )}
    </div>
  );
}
