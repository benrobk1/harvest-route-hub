import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShoppingBag, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { getAuthErrorMessage } from "@/lib/authErrors";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const ConsumerAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { roles } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState(searchParams.get('ref') || '');
  const [formError, setFormError] = useState<{ title: string; description: string } | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setReferralCode(refParam);
    }
  }, [searchParams]);


  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const fullName = formData.get("fullName") as string;
    const phone = formData.get("phone") as string;
    const street = formData.get("street") as string;
    const addressLine2 = formData.get("addressLine2") as string;
    const city = formData.get("city") as string;
    const state = formData.get("state") as string;
    const zipCode = formData.get("zipCode") as string;
    const referralCodeInput = formData.get("referralCode") as string;
    
    const fullAddress = `${street}, ${city}, ${state} ${zipCode}`;
    const acquisitionChannel = formData.get("acquisitionChannel") as string;

    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/consumer/shop`,
          data: {
            full_name: fullName,
            phone,
            street_address: street,
            address_line_2: addressLine2,
            city,
            state,
            zip_code: zipCode,
            delivery_address: fullAddress,
            acquisition_channel: acquisitionChannel,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Wait for auth trigger to complete
        await new Promise(resolve => setTimeout(resolve, 300));

        // Assign consumer role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: data.user.id, role: 'consumer' });

        if (roleError) {
          // Check if it's a duplicate key error (role already exists)
          if (!roleError.message?.includes('duplicate key')) {
            throw roleError;
          }
        }

        // Process referral code if provided
        if (referralCodeInput) {
          // Find referrer by code
          const { data: referrerProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', referralCodeInput.toUpperCase())
            .single();

          if (referrerProfile) {
            // Create referral record
            await supabase
              .from('referrals')
              .insert({
                referrer_id: referrerProfile.id,
                referee_id: data.user.id,
                status: 'pending'
              });
          }
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to Blue Harvests. Redirecting to shop...",
      });
      navigate("/consumer/shop");
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
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <ShoppingBag className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Consumer Access</CardTitle>
            <CardDescription>
              Shop farm-fresh produce from local farmers
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
                <form onSubmit={handleSignup} className="space-y-4">
                  {formError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{formError.title}</AlertTitle>
                      <AlertDescription>{formError.description}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input id="fullName" name="fullName" placeholder="John Doe" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email *</Label>
                    <Input 
                      id="signupEmail" 
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
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="+1 (555) 000-0000" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address *</Label>
                    <Input id="street" name="street" placeholder="123 Main St" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressLine2">Apartment, Suite, etc. (Optional)</Label>
                    <Input id="addressLine2" name="addressLine2" placeholder="Apt 4B" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input id="city" name="city" placeholder="Springfield" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State *</Label>
                      <Input id="state" name="state" placeholder="IL" required maxLength={2} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code *</Label>
                    <Input id="zipCode" name="zipCode" placeholder="10001" required maxLength={5} />
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
                    <Label htmlFor="referralCode">Referral Code (Optional)</Label>
                    <Input 
                      id="referralCode" 
                      name="referralCode" 
                      placeholder="BH12345678" 
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a friend's referral code and they'll get $25 credit when you complete your first order
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Password *</Label>
                    <Input 
                      id="signupPassword" 
                      name="password" 
                      type="password" 
                      placeholder="Enter your password" 
                      required 
                      onChange={(e) => {
                        validatePassword(e.target.value);
                        const confirmPwd = (document.getElementById('confirmPassword') as HTMLInputElement)?.value;
                        if (confirmPwd) validateConfirmPassword(e.target.value, confirmPwd);
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
                      name="confirmPassword" 
                      type="password" 
                      placeholder="Re-enter your password" 
                      required 
                      onChange={(e) => {
                        const pwd = (document.getElementById('signupPassword') as HTMLInputElement)?.value;
                        validateConfirmPassword(pwd, e.target.value);
                      }}
                      className={confirmPasswordError ? 'border-destructive' : ''}
                    />
                    {confirmPasswordError && <p className="text-xs text-destructive">{confirmPasswordError}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    By signing up, you'll receive a 2FA code for verification
                  </p>
                </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsumerAuth;
