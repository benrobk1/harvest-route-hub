import { useEffect, useRef } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, X } from 'lucide-react';

export const InstallPromptToast = () => {
  const { showPrompt, handleInstall, handleDismiss } = useInstallPrompt();
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (showPrompt && !hasShownToast.current) {
      hasShownToast.current = true;
      
      toast(
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Install Blue Harvests</p>
                <p className="text-xs text-muted-foreground">
                  Quick access from your home screen
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstall} className="flex-1">
              Install App
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>,
        {
          duration: 10000,
          position: 'bottom-center',
          id: 'install-prompt',
        }
      );
    }
    
    if (!showPrompt) {
      hasShownToast.current = false;
    }
  }, [showPrompt, handleInstall, handleDismiss]);

  return null;
};
