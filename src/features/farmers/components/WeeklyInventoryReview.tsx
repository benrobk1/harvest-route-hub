import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { farmerQueries } from '@/features/farmers';

interface WeeklyInventoryReviewProps {
  farmProfileId: string;
}

export function WeeklyInventoryReview({ farmProfileId }: WeeklyInventoryReviewProps) {
  const queryClient = useQueryClient();
  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: products, isLoading } = useQuery({
    queryKey: farmerQueries.productsReview(farmProfileId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('farm_profile_id', farmProfileId)
        .order('last_reviewed_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('products')
        .update({ last_reviewed_at: new Date().toISOString() })
        .eq('farm_profile_id', farmProfileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: farmerQueries.productsReview('') });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('All products reviewed successfully!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  const needsReview = products?.filter(p => {
    const lastReviewed = new Date(p.last_reviewed_at || p.updated_at);
    const isOld = lastReviewed < SEVEN_DAYS_AGO;
    const isPending = !p.approved;
    return isOld || isPending;
  }) || [];

  const allReviewed = needsReview.length === 0 && products && products.length > 0;

  if (isLoading) {
    return null;
  }

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <Card className={needsReview.length > 0 ? 'border-warning' : 'border-success'}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {needsReview.length > 0 ? (
              <AlertCircle className="h-5 w-5 text-warning" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            <CardTitle>Weekly Inventory Review</CardTitle>
          </div>
          <Badge variant={needsReview.length > 0 ? 'destructive' : 'default'}>
            {needsReview.length} Need Review
          </Badge>
        </div>
        <CardDescription>
          {allReviewed 
            ? 'All products have been reviewed this week!'
            : 'Keep your inventory fresh by reviewing products weekly'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsReview.length > 0 && (
          <Alert variant="default" className="border-warning bg-warning/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {needsReview.length} product{needsReview.length !== 1 ? 's' : ''} haven't been reviewed in over 7 days. 
              Please verify quantities and availability.
            </AlertDescription>
          </Alert>
        )}

        {needsReview.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Products Needing Review:</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {needsReview.slice(0, 5).map(product => (
                <div key={product.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last reviewed {formatDistanceToNow(new Date(product.last_reviewed_at || product.updated_at))} ago
                    </p>
                  </div>
                  <Badge variant="outline">{product.available_quantity} available</Badge>
                </div>
              ))}
              {needsReview.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  ...and {needsReview.length - 5} more
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={() => approveAllMutation.mutate()}
            disabled={approveAllMutation.isPending || needsReview.length === 0}
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {approveAllMutation.isPending ? 'Reviewing...' : 'Approve All Products'}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/farmer/inventory'}
          >
            Review Individually
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
