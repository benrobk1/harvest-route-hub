import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sprout } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FarmerAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [farmerType, setFarmerType] = useState<"lead" | "regular">("regular");
  const [formData, setFormData] = useState({
    farmName: "",
    ownerName: "",
    email: "",
    phone: "",
    farmAddress: "",
    zipCode: "",
    farmSize: "",
    produceTypes: "",
    additionalInfo: "",
    collectionPointLeadFarmer: "", // for regular farmers
    collectionPointAddress: "", // for lead farmers
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Welcome back!",
        description: "Redirecting to your farmer portal...",
      });
      navigate("/farmer/dashboard");
    }, 1500);
  };

  const handleInterestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // In a real app, this would send an email to benjaminrk@blueharvests.net
    console.log("Farmer Interest Form Submitted:", formData);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Application Submitted!",
        description: "Thank you for your interest. We'll contact you at " + formData.email,
      });

      // Reset form
      setFormData({
        farmName: "",
        ownerName: "",
        email: "",
        phone: "",
        farmAddress: "",
        zipCode: "",
        farmSize: "",
        produceTypes: "",
        additionalInfo: "",
        collectionPointLeadFarmer: "",
        collectionPointAddress: "",
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
          Back to Home
        </Button>

        <Card className="border-2 shadow-large">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-earth/10 flex items-center justify-center mb-2">
              <Sprout className="h-7 w-7 text-earth" />
            </div>
            <CardTitle className="text-2xl">Farmer Portal</CardTitle>
            <CardDescription>
              Keep 90% of your sales and connect with local customers
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
                    <Input id="email" type="email" placeholder="you@example.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="••••••••" required />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleInterestFormSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>I am a:</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="farmerType"
                          value="regular"
                          checked={farmerType === "regular"}
                          onChange={(e) => setFarmerType(e.target.value as "lead" | "regular")}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Farmer (drop-off at collection point)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="farmerType"
                          value="lead"
                          checked={farmerType === "lead"}
                          onChange={(e) => setFarmerType(e.target.value as "lead" | "regular")}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Lead Farmer (collection point)</span>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="farmName">Farm Name</Label>
                    <Input 
                      id="farmName" 
                      placeholder="Green Valley Farm" 
                      required 
                      value={formData.farmName}
                      onChange={(e) => setFormData({...formData, farmName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">Your Name</Label>
                    <Input 
                      id="ownerName" 
                      placeholder="John Smith" 
                      required 
                      value={formData.ownerName}
                      onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
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
                    <Label htmlFor="farmAddress">Farm Address</Label>
                    <Input 
                      id="farmAddress" 
                      placeholder="123 Farm Road" 
                      required 
                      value={formData.farmAddress}
                      onChange={(e) => setFormData({...formData, farmAddress: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
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
                    <Label htmlFor="farmSize">Farm Size (acres)</Label>
                    <Input 
                      id="farmSize" 
                      placeholder="50" 
                      value={formData.farmSize}
                      onChange={(e) => setFormData({...formData, farmSize: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="produceTypes">Types of Produce</Label>
                    <Input 
                      id="produceTypes" 
                      placeholder="Tomatoes, lettuce, corn..." 
                      value={formData.produceTypes}
                      onChange={(e) => setFormData({...formData, produceTypes: e.target.value})}
                    />
                  </div>
                  
                  {farmerType === "regular" && (
                    <div className="space-y-2">
                      <Label htmlFor="collectionPointLeadFarmer">Lead Farmer / Collection Point</Label>
                      <Input 
                        id="collectionPointLeadFarmer" 
                        placeholder="Name of lead farmer you'll drop off to" 
                        value={formData.collectionPointLeadFarmer}
                        onChange={(e) => setFormData({...formData, collectionPointLeadFarmer: e.target.value})}
                      />
                    </div>
                  )}
                  
                  {farmerType === "lead" && (
                    <div className="space-y-2">
                      <Label htmlFor="collectionPointAddress">Collection Point Address</Label>
                      <Input 
                        id="collectionPointAddress" 
                        placeholder="Address where farmers will drop off" 
                        required
                        value={formData.collectionPointAddress}
                        onChange={(e) => setFormData({...formData, collectionPointAddress: e.target.value})}
                      />
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="additionalInfo">Additional Information</Label>
                    <Textarea 
                      id="additionalInfo" 
                      placeholder="Tell us about your farm..." 
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

export default FarmerAuth;
