import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Phone, Mail, Calendar, ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function MyLeadFarmer() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('collection_point_lead_farmer_id')
        .eq('id', user?.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: leadFarmerData, isLoading } = useQuery({
    queryKey: ['lead-farmer-info', profile?.collection_point_lead_farmer_id],
    queryFn: async () => {
      if (!profile?.collection_point_lead_farmer_id) return null;

      const { data: leadProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.collection_point_lead_farmer_id)
        .single();

      const { data: farmProfile } = await supabase
        .from('farm_profiles')
        .select('*')
        .eq('farmer_id', profile.collection_point_lead_farmer_id)
        .single();

      return {
        profile: leadProfile,
        farmProfile,
      };
    },
    enabled: !!profile?.collection_point_lead_farmer_id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!leadFarmerData) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/farmer/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>No Lead Farmer Assigned</CardTitle>
            <CardDescription>You are not currently affiliated with a lead farmer collection point</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { profile: leadProfile, farmProfile } = leadFarmerData;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/farmer/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      <div>
        <h1 className="text-3xl font-bold">Your Collection Point</h1>
        <p className="text-muted-foreground">Where you deliver your harvest</p>
      </div>
      </div>

      {/* Collection Point Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <MapPin className="h-6 w-6" />
            {farmProfile?.farm_name}
          </CardTitle>
          <CardDescription>
            Managed by <span className="font-semibold">{leadProfile?.full_name}</span>
            <Badge variant="outline" className="ml-2">Lead Farmer</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {farmProfile?.bio && (
            <p className="text-sm text-muted-foreground">{farmProfile.bio}</p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact</h3>
              
              {leadProfile?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${leadProfile.phone}`} className="text-sm text-primary hover:underline">
                    {leadProfile.phone}
                  </a>
                </div>
              )}

              {leadProfile?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${leadProfile.email}`} className="text-sm text-primary hover:underline">
                    {leadProfile.email}
                  </a>
                </div>
              )}
            </div>

            {/* Address Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Location</h3>
              
              {leadProfile?.collection_point_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <p className="text-sm">{leadProfile.collection_point_address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Schedule */}
          {leadProfile?.delivery_schedule && leadProfile.delivery_schedule.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Delivery Schedule</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {leadProfile.delivery_schedule.map((day: string) => (
                  <Badge key={day} variant="secondary">
                    {day}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Commission Rate */}
          {leadProfile?.commission_rate && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Commission Rate</p>
              <p className="text-2xl font-bold">{leadProfile.commission_rate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Coordination fee for collection point services
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Public Profile */}
      {farmProfile?.id && (
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-medium">View Public Farm Profile</p>
              <p className="text-sm text-muted-foreground">See how customers view this collection point</p>
            </div>
            <Button onClick={() => navigate(`/farm/${farmProfile.id}`)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Profile
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
