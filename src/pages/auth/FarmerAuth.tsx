import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sprout, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { getAuthErrorMessage } from "@/lib/authErrors";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const FarmerAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [farmerType, setFarmerType] = useState<"lead" | "regular">("regular");
  const [formError, setFormError] = useState<{ title: string; description: string } | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [produceItems, setProduceItems] = useState<string[]>([]);
  const [leadFarmers, setLeadFarmers] = useState<Array<{id: string, farm_name: string, full_name: string}>>([]);
  const [leadFarmersLoading, setLeadFarmersLoading] = useState(true);
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
    additionalInfo: "",
    collectionPointLeadFarmer: "",
  });

  // Fetch approved lead farmers for dropdown
  useEffect(() => {
    const fetchLeadFarmers = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, farm_name, full_name')
          .eq('applied_role', 'lead_farmer')
          .eq('approval_status', 'approved')
          .order('farm_name');
        
        if (error) throw error;
        if (data) setLeadFarmers(data);
      } catch (error) {
        console.error('Error fetching lead farmers:', error);
      } finally {
        setLeadFarmersLoading(false);
      }
    };
    fetchLeadFarmers();
  }, []);


  const handleInterestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    
    try {
      // Validate required fields
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        throw new Error("Please fill in all required fields");
      }

      // For regular farmers, require lead farmer selection
      if (farmerType === "regular" && !formData.collectionPointLeadFarmer) {
        throw new Error("Please select a lead farmer / collection point");
      }

      emailSchema.parse(formData.email);
      passwordSchema.parse(formData.password);

      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // Check if email already has an account
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id, approval_status')
        .eq('email', formData.email)
        .single();

      if (existingUser) {
        if (existingUser.approval_status === 'pending') {
          throw new Error('An application with this email is already pending approval. Please wait for admin review.');
        } else {
          throw new Error('An account with this email already exists. Try logging in instead.');
        }
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

      if (signupError) {
        throw new Error(`Account creation failed: ${signupError.message}`);
      }
      if (!authData.user) {
        throw new Error("Account creation failed: No user returned");
      }

      // Wait for auth trigger to complete before updating profile
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assign farmer role immediately (prevents role assignment issues)
      const roleToAssign = farmerType === "lead" ? 'lead_farmer' : 'farmer';
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ 
          user_id: authData.user.id, 
          role: roleToAssign 
        });

      if (roleError) {
        // Role already exists or other error - log but don't fail
        console.error('Role assignment warning:', roleError);
      }

      // For lead farmers, use their farm address as the collection point
      const collectionPointAddress = farmerType === "lead" 
        ? `${formData.streetAddress}${formData.streetAddressLine2 ? `, ${formData.streetAddressLine2}` : ''}, ${formData.city}, ${formData.state} ${formData.zipCode}`
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
          collection_point_lead_farmer_id: farmerType === "regular" ? formData.collectionPointLeadFarmer : null,
          approval_status: 'pending',
          acquisition_channel: acquisitionChannel,
          applied_role: farmerType === "lead" ? "lead_farmer" : "farmer",
          farm_size: formData.farmSize,
          produce_types: JSON.stringify(produceItems),
          additional_info: formData.additionalInfo,
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        // User was created but profile update failed - need cleanup
        throw new Error(`Profile setup failed: ${profileError.message}`);
      }

      toast({
        title: "Application Submitted!",
        description: "You can log in once approved by an admin.",
      });

      // Reset form
      setProduceItems([]);
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
        additionalInfo: "",
        collectionPointLeadFarmer: "",
      });
    } catch (error: unknown) {
      const errorMsg = getAuthErrorMessage(error instanceof Error ? error : new Error('Account creation failed'));
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
            <div className="mb-4">
              <p className="text-center text-sm text-muted-foreground mb-4">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary hover:underline font-medium">
                  Sign in here
                </Link>
              </p>
            </div>
            <div className="w-full">
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
                      placeholder="Enter your password" 
                      required 
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({...formData, password: e.target.value});
                        validatePassword(e.target.value);
                        if (formData.confirmPassword) validateConfirmPassword(e.target.value, formData.confirmPassword);
                      }}
                      className={passwordError ? 'border-destructive' : ''}
                    />
                    {passwordError ? (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Must be at least 6 characters long</p>
                    )}
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
                    <Label htmlFor="streetAddress">
                      {farmerType === "lead" ? "Farm/Collection Point Address *" : "Farm Street Address *"}
                    </Label>
                    {farmerType === "lead" && (
                      <p className="text-xs text-muted-foreground mb-1">
                        This address will serve as the collection point for other farmers
                      </p>
                    )}
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
                  
                  <div className="space-y-3 border-t pt-4">
                    <Label>Types of Produce</Label>
                    <p className="text-sm text-muted-foreground">Add the types of produce or products you plan to sell</p>
                    {produceItems.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input 
                          value={item}
                          onChange={(e) => {
                            const updated = [...produceItems];
                            updated[index] = e.target.value;
                            setProduceItems(updated);
                          }}
                          placeholder="e.g., Tomatoes, Fresh Eggs, Honey"
                        />
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => setProduceItems(produceItems.filter((_, i) => i !== index))}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => setProduceItems([...produceItems, ''])}
                    >
                      + Add Produce Type
                    </Button>
                  </div>
                  
                  {farmerType === "regular" && (
                    <div className="space-y-2">
                      <Label htmlFor="collectionPointLeadFarmer">Lead Farmer / Collection Point *</Label>
                      <p className="text-xs text-muted-foreground">
                        Select the lead farmer you'll drop off your produce to
                      </p>
                      {leadFarmersLoading ? (
                        <p className="text-sm text-muted-foreground">Loading lead farmers...</p>
                      ) : leadFarmers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No approved lead farmers available yet. Please check back later.</p>
                      ) : (
                        <select
                          id="collectionPointLeadFarmer"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background"
                          value={formData.collectionPointLeadFarmer}
                          onChange={(e) => setFormData({...formData, collectionPointLeadFarmer: e.target.value})}
                          required
                        >
                          <option value="">-- Select a lead farmer --</option>
                          {leadFarmers.map(lf => (
                            <option key={lf.id} value={lf.id}>
                              {lf.farm_name} ({lf.full_name})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FarmerAuth;
