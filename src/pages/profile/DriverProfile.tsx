import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StripeConnectButton } from "@/components/StripeConnectButton";
import { DocumentUpload } from "@/components/DocumentUpload";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

const DriverProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
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
    vehicle_type: "",
    vehicle_make: "",
    vehicle_year: "",
    license_number: "",
    approval_status: "pending",
    driver_license_url: null,
    insurance_url: null,
    rejected_reason: null,
    delivery_days: [] as string[],
  });

  const loadProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth/driver");
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
        vehicle_type: data.vehicle_type || "",
        vehicle_make: data.vehicle_make || "",
        vehicle_year: data.vehicle_year || "",
        license_number: data.license_number || "",
        approval_status: data.approval_status || "pending",
        driver_license_url: data.driver_license_url,
        insurance_url: data.insurance_url,
        rejected_reason: data.rejected_reason,
        delivery_days: data.delivery_days || [],
      });
    }
  }, [navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
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
        vehicle_type: profile.vehicle_type,
        vehicle_make: profile.vehicle_make,
        vehicle_year: profile.vehicle_year,
        license_number: profile.license_number,
        delivery_days: profile.delivery_days,
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

  return (
    <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/driver/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="border-2 shadow-large">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
              <Truck className="h-7 w-7 text-secondary" />
            </div>
            <CardTitle className="text-2xl">Driver Profile</CardTitle>
            <CardDescription>
              Update your personal and vehicle information
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
              </TabsList>

              <TabsContent value="personal">
                <form onSubmit={handleSave} className="space-y-4">
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
                <Label htmlFor="license_number">Driver's License Number</Label>
                <Input
                  id="license_number"
                  value={profile.license_number}
                  onChange={(e) => setProfile({ ...profile, license_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_type">Vehicle Type</Label>
                <Input
                  id="vehicle_type"
                  value={profile.vehicle_type}
                  onChange={(e) => setProfile({ ...profile, vehicle_type: e.target.value })}
                  placeholder="Sedan, SUV, Truck, etc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_make">Vehicle Make & Model</Label>
                <Input
                  id="vehicle_make"
                  value={profile.vehicle_make}
                  onChange={(e) => setProfile({ ...profile, vehicle_make: e.target.value })}
                  placeholder="Honda Accord"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle_year">Vehicle Year</Label>
                <Input
                  id="vehicle_year"
                  value={profile.vehicle_year}
                  onChange={(e) => setProfile({ ...profile, vehicle_year: e.target.value })}
                  placeholder="2020"
                />
              </div>

              <div className="space-y-3">
                <Label>Preferred Delivery Days</Label>
                <p className="text-sm text-muted-foreground">
                  Select days you're available to deliver. Routes on these days will appear first in Available Routes.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day}`}
                        checked={profile.delivery_days.includes(day)}
                        onCheckedChange={(checked) => {
                          const newDays = checked
                            ? [...profile.delivery_days, day]
                            : profile.delivery_days.filter(d => d !== day);
                          setProfile({ ...profile, delivery_days: newDays });
                        }}
                      />
                      <Label htmlFor={`day-${day}`} className="font-normal cursor-pointer">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
                {profile.delivery_days.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {profile.delivery_days.map((day) => (
                      <Badge key={day} variant="secondary">
                        {day}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                {userId && (
                  <>
                    <DocumentUpload
                      userId={userId}
                      documentType="driver_license"
                      currentUrl={profile.driver_license_url || undefined}
                      onUploadComplete={loadProfile}
                    />
                    <DocumentUpload
                      userId={userId}
                      documentType="insurance"
                      currentUrl={profile.insurance_url || undefined}
                      onUploadComplete={loadProfile}
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="payments">
                <div className="space-y-4">
                  <StripeConnectButton />
                  <p className="text-sm text-muted-foreground text-center pt-4">
                    View detailed payout metrics on the <a href="/driver/payouts" className="text-primary hover:underline">Payouts Dashboard</a>
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverProfile;
