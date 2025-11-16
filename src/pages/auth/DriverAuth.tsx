import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { getAuthErrorMessage } from "@/lib/authErrors";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const DriverAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<{ title: string; description: string } | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    licenseNumber: "",
    vehicleType: "",
    vehicleMake: "",
    vehicleYear: "",
    streetAddress: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    availability: [] as string[],
    additionalInfo: "",
  });


  const handleInterestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    
    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || 
          !formData.phone || !formData.licenseNumber || !formData.vehicleType || 
          !formData.streetAddress || !formData.city || !formData.state || !formData.zipCode) {
        throw new Error("Please fill in all required fields");
      }

      emailSchema.parse(formData.email);
      passwordSchema.parse(formData.password);

      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const acquisitionChannel = (document.getElementById('acquisitionChannel') as HTMLSelectElement)?.value || 'organic';

      // Create user account
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error("Failed to create user account");

      // Wait for auth trigger to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Assign driver role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'driver'
        });

      if (roleError) {
        // Check if it's a duplicate key error (role already exists)
        if (!roleError.message?.includes('duplicate key')) {
          throw roleError;
        }
      }

      // Update profile with driver information
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.name,
          phone: formData.phone,
          street_address: formData.streetAddress,
          address_line_2: formData.addressLine2,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zipCode,
          vehicle_type: formData.vehicleType,
          vehicle_make: formData.vehicleMake,
          vehicle_year: formData.vehicleYear,
          license_number: formData.licenseNumber,
          approval_status: 'pending',
          applied_role: 'driver',
          acquisition_channel: acquisitionChannel,
          delivery_days: formData.availability.length > 0 ? formData.availability : null,
          additional_info: formData.additionalInfo || null,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      toast({
        title: "Application Submitted!",
        description: "You can log in once approved by an admin.",
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        phone: "",
        licenseNumber: "",
        vehicleType: "",
        vehicleMake: "",
        vehicleYear: "",
        streetAddress: "",
        addressLine2: "",
        city: "",
        state: "",
        zipCode: "",
        availability: [],
        additionalInfo: "",
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
            <div className="mx-auto h-14 w-14 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
              <Truck className="h-7 w-7 text-secondary" />
            </div>
            <CardTitle className="text-2xl">Driver Access</CardTitle>
            <CardDescription>
              Earn 100% of delivery fees plus tips
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
                    <Label htmlFor="driverName">Full Name *</Label>
                    <Input 
                      id="driverName" 
                      placeholder="John Doe" 
                      required 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
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
                    <Label htmlFor="license">Driver&apos;s License Number *</Label>
                    <Input 
                      id="license" 
                      placeholder="DL12345678" 
                      required 
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle">Vehicle Type *</Label>
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
                    <Label htmlFor="streetAddress">Street Address *</Label>
                    <Input 
                      id="streetAddress" 
                      placeholder="123 Main St" 
                      required 
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({...formData, streetAddress: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Apartment, Suite, etc. (Optional)</Label>
                    <Input 
                      id="addressLine2" 
                      placeholder="Apt 4B" 
                      value={formData.addressLine2}
                      onChange={(e) => setFormData({...formData, addressLine2: e.target.value})}
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
                        onChange={(e) => setFormData({...formData, state: e.target.value})}
                      />
                    </div>
                  </div>
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
                  <div className="space-y-3">
                    <Label>Preferred Delivery Days</Label>
                    <p className="text-sm text-muted-foreground">
                      Select days you're available to deliver
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                        <div key={day} className="flex items-center space-x-2">
                          <Checkbox
                            id={`signup-day-${day}`}
                            checked={formData.availability.includes(day)}
                            onCheckedChange={(checked) => {
                              const newDays = checked
                                ? [...formData.availability, day]
                                : formData.availability.filter(d => d !== day);
                              setFormData({ ...formData, availability: newDays });
                            }}
                          />
                          <Label htmlFor={`signup-day-${day}`} className="font-normal cursor-pointer">
                            {day}
                          </Label>
                        </div>
                      ))}
                    </div>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DriverAuth;
