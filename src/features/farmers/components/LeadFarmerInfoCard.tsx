import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Phone, Mail, Calendar, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { farmerQueries } from '@/features/farmers';

interface LeadFarmerInfoCardProps {
  leadFarmerId: string;
}

export function LeadFarmerInfoCard({ leadFarmerId }: LeadFarmerInfoCardProps) {
  const navigate = useNavigate();
  const { data: leadFarmerInfo, isLoading } = useQuery({
    queryKey: farmerQueries.leadFarmer.info(leadFarmerId),
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone, email, collection_point_address, delivery_schedule')
        .eq('id', leadFarmerId)
        .single();
      
      if (profileError) throw profileError;

      const { data: farmProfile } = await supabase
        .from('farm_profiles')
        .select('farm_name, bio, location')
        .eq('farmer_id', leadFarmerId)
        .maybeSingle();

      return {
        ...profile,
        farm_name: farmProfile?.farm_name,
        farm_bio: farmProfile?.bio,
        farm_location: farmProfile?.location,
      };
    },
    enabled: !!leadFarmerId,
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!leadFarmerInfo) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Collection Point</CardTitle>
        <CardDescription>
          Deliver your products to this location
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{leadFarmerInfo.farm_name || 'Collection Point'}</h3>
          <p className="text-sm text-muted-foreground">Managed by {leadFarmerInfo.full_name}</p>
        </div>

        {leadFarmerInfo.farm_bio && (
          <p className="text-sm">{leadFarmerInfo.farm_bio}</p>
        )}

        <div className="space-y-2">
          {leadFarmerInfo.collection_point_address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{leadFarmerInfo.collection_point_address}</span>
            </div>
          )}

          {leadFarmerInfo.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${leadFarmerInfo.phone}`} className="text-sm hover:underline">
                {leadFarmerInfo.phone}
              </a>
            </div>
          )}

          {leadFarmerInfo.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${leadFarmerInfo.email}`} className="text-sm hover:underline">
                {leadFarmerInfo.email}
              </a>
            </div>
          )}

          {leadFarmerInfo.delivery_schedule && leadFarmerInfo.delivery_schedule.length > 0 && (
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {leadFarmerInfo.delivery_schedule.map((day: string) => (
                  <Badge key={day} variant="secondary" className="text-xs">
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate('/farmer/my-lead-farmer')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}
