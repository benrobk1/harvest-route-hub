import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Only increment visit count once per browser session
    const hasIncrementedThisSession = sessionStorage.getItem('visitCountIncremented');
    
    if (!hasIncrementedThisSession) {
      const visitCount = parseInt(localStorage.getItem('visitCount') || '0');
      localStorage.setItem('visitCount', (visitCount + 1).toString());
      sessionStorage.setItem('visitCountIncremented', 'true');
    }

    const visitCount = parseInt(localStorage.getItem('visitCount') || '0');
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = localStorage.getItem('installPromptDismissed');

    // Show prompt on 3rd visit if mobile, not installed, and not dismissed
    if (visitCount >= 3 && isMobile && !isStandalone && !dismissed) {
      setShowPrompt(true);
    }

    // Listen for install prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback: direct user to install page
      window.location.href = '/install';
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', 'true');
  };

  return { showPrompt, handleInstall, handleDismiss, canInstall: !!deferredPrompt };
};
