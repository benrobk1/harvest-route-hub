import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { X, Home } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "admin@demo.com", role: "Admin", path: "/admin/dashboard" },
  { email: "consumer1@demo.com", role: "Consumer", path: "/consumer/shop" },
  { email: "driver1@demo.com", role: "Driver", path: "/driver/dashboard" },
  { email: "farmer1@demo.com", role: "Farmer", path: "/farmer/dashboard" },
];

export function DemoModeBanner() {
  const navigate = useNavigate();
  const { disableDemoMode, setCurrentDemoAccount } = useDemoMode();

  const handleQuickLogin = async (email: string, path: string) => {
    try {
      // Sign out current user
      await supabase.auth.signOut();
      
      // Sign in as demo user
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: "demo123456",
      });

      if (error) throw error;

      setCurrentDemoAccount(email);
      toast.success(`Logged in as ${email}`);
      navigate(path);
    } catch (error: any) {
      toast.error(`Login failed: ${error.message}`);
    }
  };

  const handleDisableDemo = () => {
    if (confirm('Are you sure you want to disable demo mode? You will be signed out and the demo banner will disappear. Demo data will remain in the database.')) {
      disableDemoMode();
      navigate('/');
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="font-semibold text-foreground">DEMO MODE ACTIVE</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">
              • Zero typing required • All data pre-loaded
            </span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-xs"
            >
              <Home className="h-4 w-4 mr-1" />
              Home
            </Button>
            <span className="text-sm text-muted-foreground mx-2 hidden sm:inline">|</span>
            <span className="text-sm text-muted-foreground mr-2 hidden sm:inline">Quick Login:</span>
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                size="sm"
                onClick={() => handleQuickLogin(account.email, account.path)}
                className="text-xs"
              >
                {account.role}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisableDemo}
              className="text-xs text-muted-foreground hover:text-destructive ml-2"
            >
              <X className="h-4 w-4 mr-1" />
              Disable
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
