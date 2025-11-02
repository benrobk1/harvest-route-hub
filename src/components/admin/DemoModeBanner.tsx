import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { X, Home } from "lucide-react";

export function DemoModeBanner() {
  const navigate = useNavigate();
  const { disableDemoMode } = useDemoMode();

  const handleDisableDemo = () => {
    if (confirm('Are you sure you want to disable demo mode? You will be signed out and the demo banner will disappear. Demo data will remain in the database.')) {
      disableDemoMode();
      navigate('/');
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="font-semibold text-foreground">DEMO MODE ACTIVE</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-xs"
            >
              <Home className="h-4 w-4 mr-1" />
              Home
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisableDemo}
              className="text-xs text-muted-foreground hover:text-destructive"
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
