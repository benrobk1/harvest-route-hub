import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, LogIn, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";
import { getAuthErrorMessage } from "@/lib/authErrors";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<{ title: string; description: string } | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleSuccessfulLogin = (userRoles: string[]) => {
    // Priority order for multi-role users
    if (userRoles.includes('admin')) {
      navigate('/admin/dashboard');
    } else if (userRoles.includes('lead_farmer')) {
      navigate('/farmer/dashboard');
    } else if (userRoles.includes('farmer')) {
      navigate('/farmer/dashboard');
    } else if (userRoles.includes('driver')) {
      navigate('/driver/dashboard');
    } else if (userRoles.includes('consumer')) {
      navigate('/consumer/shop');
    } else {
      // Fallback for users with no roles (shouldn't happen)
      navigate('/');
    }
  };

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

      // Retry logic for network failures
      let lastError;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) throw error;
          lastError = null;
          break; // Success, exit retry loop
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : '';
          // If it's a network error and not the last attempt, retry
          if (attempt < 1 && (message.includes('fetch') || message.includes('network'))) {
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw err;
        }
      }

      if (lastError) throw lastError;

      // Wait for roles to load
      await new Promise(resolve => setTimeout(resolve, 200));

      // Get user roles
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user?.id);

      const roles = userRoles?.map(r => r.role) || [];

      if (roles.length === 0) {
        await supabase.auth.signOut();
        throw new Error("Your account doesn't have assigned roles. Please contact support.");
      }

      toast({
        title: "Welcome back!",
        description: "Redirecting...",
      });

      handleSuccessfulLogin(roles);
    } catch (error: unknown) {
      const errorMsg = getAuthErrorMessage(error instanceof Error ? error : new Error('Authentication failed'));
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
              <LogIn className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to your Blue Harvests account
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Don't have an account?
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/auth/consumer")}
                  className="text-xs"
                >
                  Shop
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/auth/driver")}
                  className="text-xs"
                >
                  Drive
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/auth/farmer")}
                  className="text-xs"
                >
                  Sell
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
