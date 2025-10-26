import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, Eye } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  available_quantity: number;
  image_url: string | null;
  farm_profiles: {
    farm_name: string;
    farmer_id: string;
  };
}

export default function ProductApproval() {
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-for-approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          farm_profiles!inner(
            farm_name,
            farmer_id
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-for-approval"] });
      toast.success("Product rejected and removed");
    },
    onError: () => {
      toast.error("Failed to reject product");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Product Approval</h1>
          <p className="text-sm text-muted-foreground">
            Review and moderate farmer products
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : products && products.length > 0 ? (
              <div className="space-y-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-24 h-24 object-cover rounded"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-muted rounded flex items-center justify-center">
                        <Eye className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{product.farm_profiles.farm_name}</Badge>
                          <Badge
                            variant={
                              product.available_quantity < 10 ? "destructive" : "secondary"
                            }
                          >
                            {product.available_quantity} {product.unit} in stock
                          </Badge>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-sm text-muted-foreground">{product.description}</p>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Price:</span>
                          <span className="font-medium ml-2">
                            {formatMoney(product.price)} / {product.unit}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Are you sure you want to reject and remove this product?"
                            )
                          ) {
                            deleteProduct.mutate(product.id);
                          }
                        }}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No products to review</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
