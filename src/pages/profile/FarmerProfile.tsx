import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sprout, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { StripeConnectButton } from "@/components/StripeConnectButton";
import { PayoutsDashboard } from "@/features/payouts";
import { DocumentUpload } from "@/components/DocumentUpload";
import { TaxInformationForm } from "@/components/TaxInformationForm";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FarmerProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isLeadFarmer, setIsLeadFarmer] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    street_address: "",
    address_line_2: "",
    city: "",
    state: "",
    zip_code: "",
    farm_name: "",
    collection_point_address: "",
    delivery_schedule: [] as string[],
    approval_status: "pending",
    coi_url: null,
    rejected_reason: null,
  });

  const [farmProfile, setFarmProfile] = useState({
    farm_name: "",
    description: "",
    bio: "",
    location: "",
  });

  const daysOfWeek = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  const checkIfLeadFarmer = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "lead_farmer")
      .single();

    setIsLeadFarmer(!!data);
  }, []);

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/farmer");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error loading profile:", error);
      return;
    }

    if (data) {
      setProfile({
        full_name: data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        street_address: data.street_address || "",
        address_line_2: data.address_line_2 || "",
        city: data.city || "",
        state: data.state || "",
        zip_code: data.zip_code || "",
        farm_name: data.farm_name || "",
        collection_point_address: data.collection_point_address || "",
        delivery_schedule: data.delivery_schedule || [],
        approval_status: data.approval_status || "pending",
        coi_url: data.coi_url,
        rejected_reason: data.rejected_reason,
      });
    }

    // Load farm profile
    const { data: farmData } = await supabase
      .from("farm_profiles")
      .select("*")
      .eq("farmer_id", user.id)
      .single();

    if (farmData) {
      setFarmProfile({
        farm_name: farmData.farm_name || "",
        description: farmData.description || "",
        bio: farmData.bio || "",
        location: farmData.location || "",
      });
    }
  }, [navigate]);

  useEffect(() => {
    loadProfile();
    checkIfLeadFarmer();
  }, [loadProfile, checkIfLeadFarmer]);

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        street_address: profile.street_address,
        address_line_2: profile.address_line_2,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
        farm_name: profile.farm_name,
        collection_point_address: profile.collection_point_address,
        delivery_schedule: profile.delivery_schedule,
      })
      .eq("id", user.id);

    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    }
  };

  const handleSaveFarmProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("farm_profiles")
      .upsert({
        farmer_id: user.id,
        farm_name: farmProfile.farm_name,
        description: farmProfile.description,
        bio: farmProfile.bio,
        location: farmProfile.location,
      });

    setIsLoading(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update farm profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Farm profile updated successfully",
      });
    }
  };

  const toggleDeliveryDay = (day: string) => {
    setProfile({
      ...profile,
      delivery_schedule: profile.delivery_schedule.includes(day)
        ? profile.delivery_schedule.filter(d => d !== day)
        : [...profile.delivery_schedule, day],
    });
  };

  return (
    <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/farmer/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="border-2 shadow-large">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-earth/10 flex items-center justify-center mb-2">
              <Sprout className="h-7 w-7 text-earth" />
            </div>
            <CardTitle className="text-2xl">Farmer Profile</CardTitle>
            <CardDescription>
              Manage your personal and farm information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.approval_status === 'rejected' && profile.rejected_reason && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Application Rejected:</strong> {profile.rejected_reason}
                </AlertDescription>
              </Alert>
            )}
            
            {profile.approval_status === 'pending' && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your application is pending approval. Please upload all required documents.
                </AlertDescription>
              </Alert>
            )}

            {profile.approval_status === 'approved' && (
              <Alert className="mb-4 border-green-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700">
                  Your account has been approved!
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="farm">Farm</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="tax">Tax Info</TabsTrigger>
                <TabsTrigger value="payouts">Payouts</TabsTrigger>
              </TabsList>

              <TabsContent value="personal">
                <form onSubmit={handleSavePersonal} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Read-only)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="street_address">Street Address</Label>
                    <Input
                      id="street_address"
                      value={profile.street_address}
                      onChange={(e) => setProfile({ ...profile, street_address: e.target.value })}
                      placeholder="123 Main St"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address_line_2">Apartment, Suite, etc. (Optional)</Label>
                    <Input
                      id="address_line_2"
                      value={profile.address_line_2}
                      onChange={(e) => setProfile({ ...profile, address_line_2: e.target.value })}
                      placeholder="Apt 4B"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={profile.city}
                        onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                        placeholder="Springfield"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        value={profile.state}
                        onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                        placeholder="IL"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zip_code">ZIP Code</Label>
                    <Input
                      id="zip_code"
                      value={profile.zip_code}
                      onChange={(e) => setProfile({ ...profile, zip_code: e.target.value })}
                      placeholder="10001"
                      maxLength={5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="farm_name">Farm Name</Label>
                    <Input
                      id="farm_name"
                      value={profile.farm_name}
                      onChange={(e) => setProfile({ ...profile, farm_name: e.target.value })}
                    />
                  </div>

                  {isLeadFarmer && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="collection_point_address">Collection Point Address</Label>
                        <Input
                          id="collection_point_address"
                          value={profile.collection_point_address}
                          onChange={(e) => setProfile({ ...profile, collection_point_address: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Delivery Days</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {daysOfWeek.map((day) => (
                            <div key={day} className="flex items-center space-x-2">
                              <Checkbox
                                id={day}
                                checked={profile.delivery_schedule.includes(day)}
                                onCheckedChange={() => toggleDeliveryDay(day)}
                              />
                              <label
                                htmlFor={day}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                              >
                                {day}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="farm">
                <form onSubmit={handleSaveFarmProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="farm_profile_name">Farm Name</Label>
                    <Input
                      id="farm_profile_name"
                      value={farmProfile.farm_name}
                      onChange={(e) => setFarmProfile({ ...farmProfile, farm_name: e.target.value })}
                      placeholder="Your farm's public name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={farmProfile.location}
                      onChange={(e) => setFarmProfile({ ...farmProfile, location: e.target.value })}
                      placeholder="City, State"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Your Story</Label>
                    <Textarea
                      id="bio"
                      value={farmProfile.bio}
                      onChange={(e) => setFarmProfile({ ...farmProfile, bio: e.target.value })}
                      placeholder="Tell your story as a farmer - your journey, passion, and what drives you..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Farm Description</Label>
                    <Textarea
                      id="description"
                      value={farmProfile.description}
                      onChange={(e) => setFarmProfile({ ...farmProfile, description: e.target.value })}
                      placeholder="Describe your farm, practices, and what makes your produce special..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Farm Photos</Label>
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Photo upload coming soon
                      </p>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Farm Profile"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                {userId && (
                  <DocumentUpload
                    userId={userId}
                    documentType="coi"
                    currentUrl={profile.coi_url || undefined}
                    onUploadComplete={loadProfile}
                  />
                )}
              </TabsContent>

              <TabsContent value="payments">
                <StripeConnectButton />
              </TabsContent>

              <TabsContent value="tax">
                <TaxInformationForm />
              </TabsContent>

              <TabsContent value="payouts">
                <PayoutsDashboard />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmerProfile;
