import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Package, Edit, Trash2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/formatMoney';
import { toast } from 'sonner';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ProductForm } from '@/components/farmer/ProductForm';
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

export default function InventoryManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const { data: farmProfile } = useQuery({
    queryKey: ['farm-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('farm_profiles')
        .select('*')
        .eq('farmer_id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', farmProfile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('farm_profile_id', farmProfile?.id)
        .order('last_reviewed_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!farmProfile?.id,
  });

  const approveProductMutation = useMutation({
    mutationFn: async ({ productId, currentStatus }: { productId: string; currentStatus: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ 
          approved: !currentStatus,
          last_reviewed_at: new Date().toISOString(),
          approved_at: !currentStatus ? new Date().toISOString() : null,
          approved_by: !currentStatus ? user?.id : null
        })
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(variables.currentStatus ? 'Product unapproved' : 'Product approved');
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ productId, data }: { productId: string; data: any }) => {
      const { error } = await supabase
        .from('products')
        .update({
          name: data.name,
          description: data.description,
          price: parseFloat(data.price),
          unit: data.unit,
          available_quantity: parseInt(data.available_quantity),
          image_url: data.image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated successfully');
      setIsEditDialogOpen(false);
      setEditingProduct(null);
    },
  });

  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async (data: any) => {
    if (!editingProduct) return;
    await updateProductMutation.mutateAsync({ 
      productId: editingProduct.id, 
      data 
    });
  };

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-review'] });
      toast.success('Product deleted successfully');
      setDeletingProductId(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to delete product: ${error.message}`);
    },
  });

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (isLoading) {
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
          <h1 className="text-3xl font-bold mt-2">Inventory Management</h1>
          <p className="text-muted-foreground">Manage all your products in one place</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Products ({filteredProducts?.length || 0})</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProducts && filteredProducts.length > 0 ? (
            <div className="space-y-4">
              {filteredProducts.map((product: any) => {
                const needsReview = new Date(product.last_reviewed_at || product.updated_at) < SEVEN_DAYS_AGO;
                const lowStock = product.available_quantity < 5;

                return (
                  <Card key={product.id} className={needsReview ? 'border-warning' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{product.name}</h3>
                            {product.approved ? (
                              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                                Approved
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Pending Approval
                              </Badge>
                            )}
                            {needsReview && (
                              <Badge variant="outline" className="text-warning border-warning">
                                Needs Review
                              </Badge>
                            )}
                            {lowStock && (
                              <Badge variant="destructive">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-2">
                            {product.description}
                          </p>

                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-semibold">{formatMoney(product.price)} / {product.unit}</span>
                            <span className="flex items-center gap-1">
                              <Package className="h-4 w-4" />
                              {product.available_quantity} available
                            </span>
                            <span className="text-muted-foreground">
                              Last reviewed {formatDistanceToNow(new Date(product.last_reviewed_at || product.updated_at))} ago
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={product.approved ? 'default' : 'outline'}
                            onClick={() => approveProductMutation.mutate({ 
                              productId: product.id, 
                              currentStatus: product.approved 
                            })}
                            disabled={approveProductMutation.isPending}
                            title={product.approved ? 'Unapprove Product' : 'Approve Product'}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingProductId(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? 'No products match your search' : 'No products yet'}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductForm
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleUpdateProduct}
        defaultValues={editingProduct ? {
          name: editingProduct.name,
          description: editingProduct.description || '',
          price: String(editingProduct.price),
          unit: editingProduct.unit,
          available_quantity: String(editingProduct.available_quantity),
          image_url: editingProduct.image_url || '',
        } : undefined}
        isEdit={true}
      />

      <AlertDialog open={!!deletingProductId} onOpenChange={() => setDeletingProductId(null)}>
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
              onClick={() => deletingProductId && deleteProductMutation.mutate(deletingProductId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
