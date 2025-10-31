import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sprout, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { getAuthErrorMessage } from "@/lib/authErrors";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const FarmerAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [farmerType, setFarmerType] = useState<"lead" | "regular">("regular");
  const [formError, setFormError] = useState<{ title: string; description: string } | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [formData, setFormData] = useState({
    farmName: "",
    ownerName: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    streetAddress: "",
    streetAddressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "USA",
    farmSize: "",
    produceTypes: "",
    additionalInfo: "",
    collectionPointLeadFarmer: "",
    collectionStreetAddress: "",
    collectionStreetAddressLine2: "",
    collectionCity: "",
    collectionState: "",
    collectionZipCode: "",
  });

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    
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

      // Check if user has farmer or lead_farmer role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (!userRoles?.some(r => r.role === 'farmer' || r.role === 'lead_farmer')) {
        await supabase.auth.signOut();
        throw new Error("Your account doesn't have farmer access");
      }

      toast({
        title: "Welcome back!",
        description: "Redirecting to your farmer portal...",
      });
      navigate("/farmer/dashboard");
    } catch (error: any) {
      const errorMsg = getAuthErrorMessage(error);
      setFormError(errorMsg);
      toast({
        title: errorMsg.title,
        description: errorMsg.description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInterestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    
    try {
      // Validate required fields
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        throw new Error("Please fill in all required fields");
      }

      emailSchema.parse(formData.email);
      passwordSchema.parse(formData.password);

      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const acquisitionChannel = (document.getElementById('acquisitionChannel') as HTMLSelectElement)?.value || 'organic';

      // Create the user account
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: formData.ownerName,
            phone: formData.phone,
            farm_name: formData.farmName,
          }
        }
      });

      if (signupError) throw signupError;
      if (!authData.user) throw new Error("Failed to create user account");


      // Build collection point address for lead farmers
      const collectionPointAddress = farmerType === "lead" 
        ? `${formData.collectionStreetAddress}${formData.collectionStreetAddressLine2 ? `, ${formData.collectionStreetAddressLine2}` : ''}, ${formData.collectionCity}, ${formData.collectionState} ${formData.collectionZipCode}`
        : null;

      // Update profile with additional information
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.ownerName,
          phone: formData.phone,
          farm_name: formData.farmName,
          street_address: formData.streetAddress + (formData.streetAddressLine2 ? `, ${formData.streetAddressLine2}` : ''),
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          country: formData.country,
          collection_point_address: collectionPointAddress,
          approval_status: 'pending',
          acquisition_channel: acquisitionChannel,
          applied_role: farmerType === "lead" ? "lead_farmer" : "farmer",
          farm_size: formData.farmSize,
          produce_types: formData.produceTypes,
          additional_info: formData.additionalInfo,
        }, {
          onConflict: 'id'
        });

      if (profileError) throw profileError;

      toast({
        title: "Application Submitted!",
        description: "You can log in once approved by an admin.",
      });

      // Reset form
      setFormData({
        farmName: "",
        ownerName: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
        streetAddress: "",
        streetAddressLine2: "",
        city: "",
        state: "",
        zipCode: "",
        country: "USA",
        farmSize: "",
        produceTypes: "",
        additionalInfo: "",
        collectionPointLeadFarmer: "",
        collectionStreetAddress: "",
        collectionStreetAddressLine2: "",
        collectionCity: "",
        collectionState: "",
        collectionZipCode: "",
      });
    } catch (error: any) {
      const errorMsg = getAuthErrorMessage(error);
      setFormError(errorMsg);
      toast({
        title: errorMsg.title,
        description: errorMsg.description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    try {
      emailSchema.parse(email);
      setEmailError('');
    } catch {
      setEmailError('Please enter a valid email address');
    }
  };

  const validatePassword = (password: string) => {
    if (password.length > 0 && password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };

  const validateConfirmPassword = (password: string, confirmPassword: string) => {
    if (confirmPassword.length > 0 && password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
    } else {
      setConfirmPasswordError('');
    }
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
                  {formError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{formError.title}</AlertTitle>
                      <AlertDescription>{formError.description}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      placeholder="you@example.com" 
                      required 
                      onBlur={(e) => validateEmail(e.target.value)}
                      className={emailError ? 'border-destructive' : ''}
                    />
                    {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      placeholder="••••••••" 
                      required 
                      onChange={(e) => validatePassword(e.target.value)}
                      className={passwordError ? 'border-destructive' : ''}
                    />
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Logging in..." : "Login"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleInterestFormSubmit} className="space-y-4">
                  {formError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{formError.title}</AlertTitle>
                      <AlertDescription>{formError.description}</AlertDescription>
                    </Alert>
                  )}
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
                    <Label htmlFor="farmName">Farm Name *</Label>
                    <Input 
                      id="farmName" 
                      placeholder="Green Valley Farm" 
                      required 
                      value={formData.farmName}
                      onChange={(e) => setFormData({...formData, farmName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">Your Name *</Label>
                    <Input 
                      id="ownerName" 
                      placeholder="John Smith" 
                      required 
                      value={formData.ownerName}
                      onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email *</Label>
                    <Input 
                      id="signupEmail" 
                      type="email" 
                      placeholder="you@example.com" 
                      required 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      onBlur={(e) => validateEmail(e.target.value)}
                      className={emailError ? 'border-destructive' : ''}
                    />
                    {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="At least 6 characters" 
                      required 
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({...formData, password: e.target.value});
                        validatePassword(e.target.value);
                        if (formData.confirmPassword) validateConfirmPassword(e.target.value, formData.confirmPassword);
                      }}
                      className={passwordError ? 'border-destructive' : ''}
                    />
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      placeholder="Re-enter your password" 
                      required 
                      value={formData.confirmPassword}
                      onChange={(e) => {
                        setFormData({...formData, confirmPassword: e.target.value});
                        validateConfirmPassword(formData.password, e.target.value);
                      }}
                      className={confirmPasswordError ? 'border-destructive' : ''}
                    />
                    {confirmPasswordError && <p className="text-xs text-destructive">{confirmPasswordError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
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
                    <Label htmlFor="acquisitionChannel">How did you hear about us?</Label>
                    <select id="acquisitionChannel" name="acquisitionChannel" className="w-full h-10 px-3 rounded-md border border-input bg-background">
                      <option value="organic">Found online (Search/Website)</option>
                      <option value="referral">Friend referral</option>
                      <option value="social">Social media</option>
                      <option value="event">Farmers market / Event</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Farm Address Fields */}
                  <div className="space-y-2">
                    <Label htmlFor="streetAddress">Farm Street Address *</Label>
                    <Input 
                      id="streetAddress" 
                      placeholder="123 Farm Road" 
                      required 
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({...formData, streetAddress: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="streetAddressLine2">Address Line 2 (Optional)</Label>
                    <Input 
                      id="streetAddressLine2" 
                      placeholder="Apt, Suite, Building, etc." 
                      value={formData.streetAddressLine2}
                      onChange={(e) => setFormData({...formData, streetAddressLine2: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input 
                        id="city" 
                        placeholder="Springfield" 
                        required 
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Input 
                        id="state" 
                        placeholder="IL" 
                        required 
                        maxLength={2}
                        value={formData.state}
                        onChange={(e) => setFormData({...formData, state: e.target.value.toUpperCase()})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP Code *</Label>
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
                      <Label htmlFor="country">Country *</Label>
                      <Input 
                        id="country" 
                        placeholder="USA" 
                        required 
                        value={formData.country}
                        onChange={(e) => setFormData({...formData, country: e.target.value})}
                      />
                    </div>
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

                  {/* Collection Point Address for Lead Farmers */}
                  {farmerType === "lead" && (
                    <>
                      <div className="border-t pt-4 mt-4">
                        <h3 className="font-semibold mb-4">Collection Point Address</h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="collectionStreetAddress">Street Address *</Label>
                            <Input 
                              id="collectionStreetAddress" 
                              placeholder="456 Collection Point Road" 
                              required 
                              value={formData.collectionStreetAddress}
                              onChange={(e) => setFormData({...formData, collectionStreetAddress: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="collectionStreetAddressLine2">Address Line 2 (Optional)</Label>
                            <Input 
                              id="collectionStreetAddressLine2" 
                              placeholder="Apt, Suite, Building, etc." 
                              value={formData.collectionStreetAddressLine2}
                              onChange={(e) => setFormData({...formData, collectionStreetAddressLine2: e.target.value})}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="collectionCity">City *</Label>
                              <Input 
                                id="collectionCity" 
                                placeholder="Springfield" 
                                required 
                                value={formData.collectionCity}
                                onChange={(e) => setFormData({...formData, collectionCity: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="collectionState">State *</Label>
                              <Input 
                                id="collectionState" 
                                placeholder="IL" 
                                required 
                                maxLength={2}
                                value={formData.collectionState}
                                onChange={(e) => setFormData({...formData, collectionState: e.target.value.toUpperCase()})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="collectionZipCode">ZIP *</Label>
                              <Input 
                                id="collectionZipCode" 
                                placeholder="10001" 
                                required 
                                maxLength={5}
                                value={formData.collectionZipCode}
                                onChange={(e) => setFormData({...formData, collectionZipCode: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="additionalInfo">Additional Information</Label>
                    <Textarea 
                      id="additionalInfo" 
                      placeholder="Tell us more about your farm..." 
                      rows={3}
                      value={formData.additionalInfo}
                      onChange={(e) => setFormData({...formData, additionalInfo: e.target.value})}
                    />
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
