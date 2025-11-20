import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/formatMoney';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';
import { Package, Search, CheckCircle, Edit, Trash2, AlertCircle, Plus, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ProductForm,
  BulkEditDialog,
  WeeklyInventoryReview
} from '@/features/farmers';
import { useNavigate } from 'react-router-dom';
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
import type { Database } from '@/integrations/supabase/types';

type ProductRow = Database['public']['Tables']['products']['Row'];

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  unit: string;
  quantity: string;
  image_url?: string | null;
}

export default function InventoryManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
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

  const { data: products, isLoading } = useQuery<ProductRow[] | null>({
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
    onError: (error) => {
      toast.error(`Failed to update product: ${getErrorMessage(error)}`);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const { error } = await supabase
        .from('products')
        .update({
          name: data.name,
          description: data.description,
          price: parseFloat(data.price),
          unit: data.unit,
          available_quantity: parseInt(data.quantity),
          image_url: data.image_url || null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-review'] });
      toast.success('Product updated successfully');
      setEditingProduct(null);
    },
    onError: (error) => {
      toast.error(`Failed to update product: ${getErrorMessage(error)}`);
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const { error } = await supabase.from('products').insert({
        farm_profile_id: farmProfile?.id,
        name: data.name,
        description: data.description,
        price: parseFloat(data.price),
        unit: data.unit,
        available_quantity: parseInt(data.quantity),
        image_url: data.image_url || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-products'] });
      queryClient.invalidateQueries({ queryKey: ['products-review'] });
      toast.success('Product created successfully');
      setIsAddingProduct(false);
    },
    onError: (error) => {
      toast.error(`Failed to create product: ${getErrorMessage(error)}`);
    },
  });

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
    onError: (error) => {
      toast.error(`Failed to delete product: ${getErrorMessage(error)}`);
    },
  });

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/farmer/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Product Inventory</h1>
          <p className="text-muted-foreground">Manage your products and inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkEditing(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Bulk Import/Edit
          </Button>
          <Button onClick={() => setIsAddingProduct(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Weekly Inventory Review */}
      <WeeklyInventoryReview farmProfileId={farmProfile?.id || ''} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Products List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts && filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const needsReview = new Date(product.last_reviewed_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const isLowStock = product.available_quantity < 10;
            
            return (
              <Card 
                key={product.id}
                className={
                  !product.approved 
                    ? 'border-orange-500' 
                    : needsReview 
                    ? 'border-yellow-500' 
                    : isLowStock 
                    ? 'border-blue-500' 
                    : ''
                }
              >
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                      )}
                      <p className="text-lg font-bold">{formatMoney(product.price)}/{product.unit}</p>
                      <p className={`text-sm ${isLowStock ? 'text-blue-500 font-medium' : 'text-muted-foreground'}`}>
                        {product.available_quantity} {product.unit}s available
                        {isLowStock && ' (Low Stock)'}
                      </p>
                      {!product.approved && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pending Approval
                        </Badge>
                      )}
                      {needsReview && product.approved && (
                        <Badge variant="secondary" className="text-xs">
                          Needs Review
                        </Badge>
                      )}
                      {product.last_reviewed_at && (
                        <p className="text-xs text-muted-foreground">
                          Last reviewed {formatDistanceToNow(new Date(product.last_reviewed_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={product.approved ? 'outline' : 'default'}
                      onClick={() => approveProductMutation.mutate({ 
                        productId: product.id, 
                        currentStatus: product.approved 
                      })}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {product.approved ? 'Unapprove' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingProduct(product)}
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
                </CardContent>
              </Card>
            );
          })
        ) : searchQuery ? (
          <div className="col-span-full text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No products match your search</p>
          </div>
        ) : (
          <div className="col-span-full text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No products yet</p>
            <Button onClick={() => setIsAddingProduct(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Product
            </Button>
          </div>
        )}
      </div>

      {/* Product Form Dialog */}
      <ProductForm
        open={isAddingProduct || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingProduct(false);
            setEditingProduct(null);
          }
        }}
        onSubmit={async (data) => {
          if (editingProduct) {
            await updateProductMutation.mutateAsync({ id: editingProduct.id, data });
          } else {
            await createProductMutation.mutateAsync(data);
          }
        }}
        defaultValues={editingProduct ? {
          name: editingProduct.name,
          description: editingProduct.description || '',
          price: editingProduct.price.toString(),
          unit: editingProduct.unit,
          available_quantity: editingProduct.available_quantity.toString(),
          image_url: editingProduct.image_url || '',
        } : undefined}
        isEdit={!!editingProduct}
      />

      {/* Bulk Edit Dialog */}
      <BulkEditDialog
        open={isBulkEditing}
        onOpenChange={setIsBulkEditing}
        farmProfileId={farmProfile?.id || ''}
        products={products || []}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['farmer-products'] });
          queryClient.invalidateQueries({ queryKey: ['products-review'] });
          setIsBulkEditing(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
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
