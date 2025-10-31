import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { ChevronDown, MapPin, User, Package, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  available_quantity: number;
  image_url: string | null;
  approved: boolean;
  approved_at: string | null;
  farm_profiles: {
    id: string;
    farm_name: string;
    farmer_id: string;
    profiles: {
      full_name: string;
      collection_point_lead_farmer_id: string | null;
    };
  };
}

interface GroupedProducts {
  [leadFarmerId: string]: {
    leadFarmer: {
      full_name: string;
      collection_point_address: string | null;
    } | null;
    farmers: {
      [farmerId: string]: {
        farmerName: string;
        farmName: string;
        products: Product[];
      };
    };
  };
}

export default function ProductApproval() {
  const queryClient = useQueryClient();
  const [openCollectionPoints, setOpenCollectionPoints] = useState<Record<string, boolean>>({});
  const [openFarmers, setOpenFarmers] = useState<Record<string, boolean>>({});

  const { data: products, isLoading } = useQuery({
    queryKey: ["products-for-approval"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          farm_profiles!inner(
            id,
            farm_name,
            farmer_id,
            profiles!farm_profiles_farmer_id_fkey(
              full_name,
              collection_point_lead_farmer_id
            )
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
  });

  const toggleApproval = useMutation({
    mutationFn: async ({ productId, approve }: { productId: string; approve: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("products")
        .update({
          approved: approve,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", productId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products-for-approval"] });
      toast.success("Product status updated");
    },
    onError: () => {
      toast.error("Failed to update product status");
    },
  });

  // Group products by collection point → farmer → products
  const groupedProducts: GroupedProducts = products?.reduce((acc, product) => {
    const leadFarmerId = product.farm_profiles.profiles.collection_point_lead_farmer_id || "independent";
    const farmerId = product.farm_profiles.farmer_id;

    if (!acc[leadFarmerId]) {
      acc[leadFarmerId] = {
        leadFarmer: leadFarmerId === "independent" ? null : {
          full_name: "Collection Point",
          collection_point_address: null,
        },
        farmers: {},
      };
    }

    if (!acc[leadFarmerId].farmers[farmerId]) {
      acc[leadFarmerId].farmers[farmerId] = {
        farmerName: product.farm_profiles.profiles.full_name,
        farmName: product.farm_profiles.farm_name,
        products: [],
      };
    }

    acc[leadFarmerId].farmers[farmerId].products.push(product);
    return acc;
  }, {} as GroupedProducts) || {};

  const toggleCollectionPoint = (id: string) => {
    setOpenCollectionPoints(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFarmer = (id: string) => {
    setOpenFarmers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Product Approval</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage farmer products by collection point
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Products by Collection Point</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : Object.keys(groupedProducts).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedProducts).map(([leadFarmerId, collectionData]) => (
                  <Collapsible
                    key={leadFarmerId}
                    open={openCollectionPoints[leadFarmerId]}
                    onOpenChange={() => toggleCollectionPoint(leadFarmerId)}
                  >
                    <Card className="border-2">
                      <CollapsibleTrigger asChild>
                        <div className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <MapPin className="h-5 w-5 text-primary" />
                              <div>
                                <div className="font-semibold text-lg">
                                  {leadFarmerId === "independent" 
                                    ? "Independent Farms" 
                                    : collectionData.leadFarmer?.full_name || "Unknown Collection Point"}
                                </div>
                                {collectionData.leadFarmer?.collection_point_address && (
                                  <div className="text-sm text-muted-foreground">
                                    {collectionData.leadFarmer.collection_point_address}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant="secondary">
                                {Object.keys(collectionData.farmers).length} Farm(s)
                              </Badge>
                              <Badge variant="outline">
                                {Object.values(collectionData.farmers).reduce(
                                  (sum, farmer) => sum + farmer.products.length,
                                  0
                                )} Product(s)
                              </Badge>
                              <ChevronDown
                                className={`h-5 w-5 transition-transform ${
                                  openCollectionPoints[leadFarmerId] ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-3">
                          {Object.entries(collectionData.farmers).map(([farmerId, farmerData]) => (
                            <Collapsible
                              key={farmerId}
                              open={openFarmers[farmerId]}
                              onOpenChange={() => toggleFarmer(farmerId)}
                            >
                              <Card className="bg-accent/30">
                                <CollapsibleTrigger asChild>
                                  <div className="p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                          <div className="font-medium">{farmerData.farmName}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {farmerData.farmerName}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <Badge variant="outline">
                                          <Package className="h-3 w-3 mr-1" />
                                          {farmerData.products.length} Product(s)
                                        </Badge>
                                        <ChevronDown
                                          className={`h-4 w-4 transition-transform ${
                                            openFarmers[farmerId] ? "rotate-180" : ""
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                
                                <CollapsibleContent>
                                  <div className="px-3 pb-3 space-y-2">
                                    {farmerData.products.map((product) => (
                                      <div
                                        key={product.id}
                                        className={`flex items-start gap-4 p-3 border rounded-lg bg-background ${
                                          !product.approved ? "border-destructive/50" : "border-border"
                                        }`}
                                      >
                                        {product.image_url ? (
                                          <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-16 h-16 object-cover rounded"
                                          />
                                        ) : (
                                          <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                                            <Package className="h-6 w-6 text-muted-foreground" />
                                          </div>
                                        )}

                                        <div className="flex-1 space-y-1">
                                          <div className="flex items-center justify-between">
                                            <h4 className="font-semibold">{product.name}</h4>
                                            <Badge
                                              variant={product.approved ? "default" : "destructive"}
                                            >
                                              {product.approved ? "Approved" : "Disapproved"}
                                            </Badge>
                                          </div>

                                          {product.description && (
                                            <p className="text-sm text-muted-foreground">
                                              {product.description}
                                            </p>
                                          )}

                                          <div className="flex items-center gap-4 text-sm">
                                            <span className="font-medium">
                                              {formatMoney(product.price)} / {product.unit}
                                            </span>
                                            <Badge
                                              variant={
                                                product.available_quantity < 10
                                                  ? "destructive"
                                                  : "secondary"
                                              }
                                            >
                                              {product.available_quantity} {product.unit} in stock
                                            </Badge>
                                          </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                          {product.approved ? (
                                            <Button
                                              variant="destructive"
                                              size="sm"
                                              onClick={() =>
                                                toggleApproval.mutate({
                                                  productId: product.id,
                                                  approve: false,
                                                })
                                              }
                                            >
                                              <XCircle className="h-4 w-4 mr-2" />
                                              Disapprove
                                            </Button>
                                          ) : (
                                            <Button
                                              variant="default"
                                              size="sm"
                                              onClick={() =>
                                                toggleApproval.mutate({
                                                  productId: product.id,
                                                  approve: true,
                                                })
                                              }
                                            >
                                              <CheckCircle className="h-4 w-4 mr-2" />
                                              Re-approve
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Card>
                            </Collapsible>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
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
