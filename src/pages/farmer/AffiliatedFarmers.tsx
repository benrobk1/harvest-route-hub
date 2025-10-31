import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, Mail, MapPin, Package, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function AffiliatedFarmers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: affiliatedFarmers, isLoading } = useQuery({
    queryKey: ['affiliated-farmers-detailed', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_affiliations')
        .select(`
          *,
          farm_profiles (
            id,
            farm_name,
            location,
            bio,
            farmer_id,
            profiles (
              full_name,
              email,
              phone
            )
          )
        `)
        .eq('lead_farmer_id', user?.id)
        .eq('active', true);
      
      if (error) throw error;

      // Get product counts for each farm
      const farmsWithProducts = await Promise.all(
        (data || []).map(async (affiliation) => {
          const { data: products, error: prodError } = await supabase
            .from('products')
            .select('id, name, available_quantity')
            .eq('farm_profile_id', affiliation.farm_profiles.id)
            .gt('available_quantity', 0);

          return {
            ...affiliation,
            active_products: products?.length || 0,
            product_names: products?.map(p => p.name).join(', ') || 'No active products',
          };
        })
      );

      return farmsWithProducts;
    },
    enabled: !!user?.id,
  });

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
          <h1 className="text-3xl font-bold mt-2">Affiliated Farmers</h1>
          <p className="text-muted-foreground">
            Farmers who use your collection point ({affiliatedFarmers?.length || 0} total)
          </p>
        </div>
      </div>

      {affiliatedFarmers && affiliatedFarmers.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {affiliatedFarmers.map((affiliation: any) => {
            const farmer = affiliation.farm_profiles;
            const profile = farmer.profiles;

            return (
              <Card key={affiliation.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{farmer.farm_name}</CardTitle>
                      <CardDescription>Managed by {profile.full_name}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {affiliation.commission_rate}% commission
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {farmer.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{farmer.bio}</p>
                  )}

                  <div className="space-y-2">
                    {farmer.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{farmer.location}</span>
                      </div>
                    )}

                    {profile.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${profile.phone}`} className="hover:underline">
                          {profile.phone}
                        </a>
                      </div>
                    )}

                    {profile.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${profile.email}`} className="hover:underline">
                          {profile.email}
                        </a>
                      </div>
                    )}

                    <div className="flex items-start gap-2 text-sm">
                      <Package className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{affiliation.active_products} Active Products</p>
                        <p className="text-muted-foreground text-xs line-clamp-2">
                          {affiliation.product_names}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.location.href = `/farm-profile/${farmer.farmer_id}`}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Profile
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = `mailto:${profile.email}`}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No affiliated farmers yet. Other farmers can select your collection point when they sign up.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
