import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, Mail, MapPin, Package, ExternalLink, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { farmerQueries } from '@/features/farmers';

export default function AffiliatedFarmers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: collectionPoint, isLoading: collectionPointLoading } = useQuery({
    queryKey: farmerQueries.leadFarmer.collectionPoint(user?.id || ''),
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('collection_point_address, full_name, phone, email')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: affiliatedFarmers, isLoading } = useQuery({
    queryKey: farmerQueries.affiliatedFarmersDetailed(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_affiliations')
        .select(`
          *,
          farm_profiles!inner (
            id,
            farm_name,
            location,
            bio,
            farmer_id
          )
        `)
        .eq('lead_farmer_id', user?.id)
        .eq('active', true);
      
      if (error) throw error;

      // Get product counts and farmer profile for each farm
      const farmsWithProducts = await Promise.all(
        (data || []).map(async (affiliation) => {
          const [productsResult, profileResult, userRolesResult] = await Promise.all([
            supabase
              .from('products')
              .select('id, name, available_quantity')
              .eq('farm_profile_id', affiliation.farm_profiles.id)
              .gt('available_quantity', 0),
            supabase
              .from('profiles')
              .select('full_name, email, phone, street_address, city, state, zip_code')
              .eq('id', affiliation.farm_profiles.farmer_id)
              .single(),
            supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', affiliation.farm_profiles.farmer_id)
          ]);

          const roles = userRolesResult.data?.map(r => r.role) || [];
          const isLeadFarmer = roles.includes('lead_farmer');

          return {
            ...affiliation,
            farm_profiles: {
              ...affiliation.farm_profiles,
              profiles: profileResult.data
            },
            active_products: productsResult.data?.length || 0,
            product_names: productsResult.data?.map(p => p.name).join(', ') || 'No active products',
            farmer_role: isLeadFarmer ? 'Lead Farmer' : 'Farmer',
          };
        })
      );

      return farmsWithProducts;
    },
    enabled: !!user?.id,
  });

  const displayCollectionPoint = collectionPoint;
  const displayFarmers = affiliatedFarmers;

  if (isLoading || collectionPointLoading) {
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
          <h1 className="text-3xl font-bold mt-2">Collection Point & Affiliated Farmers</h1>
          <p className="text-muted-foreground">
            Your collection point details and farmers who use it ({displayFarmers?.length || 0} total)
          </p>
        </div>
      </div>

      {/* Collection Point Information */}
      {displayCollectionPoint?.collection_point_address && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Your Collection Point
                </CardTitle>
                <CardDescription>Hub for consolidated deliveries</CardDescription>
              </div>
              <Badge variant="secondary">Collection Point</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {displayCollectionPoint.collection_point_address && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span className="font-medium">
                  {displayCollectionPoint.collection_point_address}
                </span>
              </div>
            )}
            {displayCollectionPoint.full_name && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">
                  Contact: {displayCollectionPoint.full_name}
                </span>
              </div>
            )}
            {displayCollectionPoint.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${displayCollectionPoint.phone}`} className="hover:underline">
                  {displayCollectionPoint.phone}
                </a>
              </div>
            )}
            {displayCollectionPoint.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${displayCollectionPoint.email}`} className="hover:underline">
                  {displayCollectionPoint.email}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {displayFarmers && displayFarmers.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {displayFarmers.map((affiliation) => {
            const farmer = affiliation.farm_profiles;
            const profile = farmer?.profiles;
            const farmerRole = affiliation.farmer_role;

            return (
              <Card key={affiliation.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{farmer?.farm_name || 'Unknown Farm'}</CardTitle>
                      <CardDescription>
                        Managed by {profile?.full_name || 'Unknown Farmer'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Badge variant="outline">{farmerRole}</Badge>
                      <Badge variant="secondary">
                        {affiliation.commission_rate}% commission
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {farmer?.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {farmer.bio}
                    </p>
                  )}

                  <div className="space-y-2">
                    {profile?.street_address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span>
                          {`${profile.street_address}, ${profile.city}, ${profile.state} ${profile.zip_code}`}
                        </span>
                      </div>
                    )}

                    {profile?.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${profile.phone}`} className="hover:underline">
                          {profile.phone}
                        </a>
                      </div>
                    )}

                    {profile?.email && (
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
                      onClick={() => navigate(`/farm/${farmer?.id}`)}
                      disabled={!farmer?.id}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Profile
                    </Button>
                    {profile?.email && (
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = `mailto:${profile.email}`}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
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
