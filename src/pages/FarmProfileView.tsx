import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FarmProfile {
  id: string;
  farm_name: string;
  description: string;
  location: string;
  farmer_id: string;
}

const FarmProfileView = () => {
  const { farmId } = useParams();
  const navigate = useNavigate();
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFarmProfile();
  }, [farmId]);

  const loadFarmProfile = async () => {
    if (!farmId) return;

    const { data, error } = await supabase
      .from("farm_profiles")
      .select("*")
      .eq("id", farmId)
      .single();

    if (error) {
      console.error("Error loading farm profile:", error);
    } else {
      setFarm(data);
    }

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center">
        <div className="text-center">
          <Sprout className="h-12 w-12 text-earth mx-auto mb-4 animate-pulse" />
          <p>Loading farm profile...</p>
        </div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">Farm profile not found</p>
            <Button onClick={() => navigate(-1)}>Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-earth">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="border-2 shadow-large">
          <CardHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-earth/10 flex items-center justify-center flex-shrink-0">
                <Sprout className="h-8 w-8 text-earth" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{farm.farm_name}</CardTitle>
                {farm.location && (
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {farm.location}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {farm.description && (
              <div>
                <h3 className="text-lg font-semibold mb-2">About This Farm</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {farm.description}
                </p>
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Farm Photos</h3>
              <div className="text-center py-8 text-muted-foreground">
                <p>Photos coming soon</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmProfileView;
