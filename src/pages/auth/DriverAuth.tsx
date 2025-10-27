import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const DriverAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    licenseNumber: "",
    vehicleType: "",
    vehicleMake: "",
    vehicleYear: "",
    zipCode: "",
    availability: "",
    additionalInfo: "",
  });

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Wait for roles to load
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check if user has driver role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (!userRoles?.some(r => r.role === 'driver')) {
        await supabase.auth.signOut();
        throw new Error("Your account doesn't have driver access");
      }

      toast({
        title: "Welcome back!",
        description: "Redirecting to your driver dashboard...",
      });
      navigate("/driver/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInterestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // In a real app, this would send an email to benjaminrk@blueharvests.net
    console.log("Driver Interest Form Submitted:", formData);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Application Submitted!",
        description: "Thank you for your interest. We'll contact you at " + formData.email,
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        licenseNumber: "",
        vehicleType: "",
        vehicleMake: "",
        vehicleYear: "",
        zipCode: "",
        availability: "",
        additionalInfo: "",
      });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="border-2 shadow-large">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
              <Truck className="h-7 w-7 text-secondary" />
            </div>
            <CardTitle className="text-2xl">Driver Access</CardTitle>
            <CardDescription>
              Earn 100% of delivery fees plus tips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Apply</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" placeholder="••••••••" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleInterestFormSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="driverName">Full Name</Label>
                    <Input 
                      id="driverName" 
                      placeholder="John Doe" 
                      required 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email</Label>
                    <Input 
                      id="signupEmail" 
                      type="email" 
                      placeholder="you@example.com" 
                      required 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      type="tel" 
                      placeholder="+1 (555) 000-0000" 
                      required 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license">Driver&apos;s License Number</Label>
                    <Input 
                      id="license" 
                      placeholder="DL12345678" 
                      required 
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle">Vehicle Type</Label>
                    <Input 
                      id="vehicle" 
                      placeholder="Sedan, SUV, Truck, etc." 
                      required 
                      value={formData.vehicleType}
                      onChange={(e) => setFormData({...formData, vehicleType: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleMake">Vehicle Make & Model</Label>
                    <Input 
                      id="vehicleMake" 
                      placeholder="Honda Accord" 
                      value={formData.vehicleMake}
                      onChange={(e) => setFormData({...formData, vehicleMake: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleYear">Vehicle Year</Label>
                    <Input 
                      id="vehicleYear" 
                      placeholder="2020" 
                      value={formData.vehicleYear}
                      onChange={(e) => setFormData({...formData, vehicleYear: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Your ZIP Code</Label>
                    <Input 
                      id="zipCode" 
                      placeholder="10001" 
                      required 
                      maxLength={5}
                      value={formData.zipCode}
                      onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="availability">Availability</Label>
                    <Input 
                      id="availability" 
                      placeholder="Weekdays, weekends, specific days..." 
                      value={formData.availability}
                      onChange={(e) => setFormData({...formData, availability: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="additionalInfo">Additional Information</Label>
                    <Textarea 
                      id="additionalInfo" 
                      placeholder="Tell us about your driving experience..." 
                      value={formData.additionalInfo}
                      onChange={(e) => setFormData({...formData, additionalInfo: e.target.value})}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                    Your application will be sent to benjaminrk@blueharvests.net for review.
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Submitting..." : "Submit Application"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverAuth;
