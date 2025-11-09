import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

/**
 * SENTRY HEALTH CHECK
 * 
 * Displays a warning banner in production if Sentry is not configured.
 * This ensures developers are aware that error tracking is disabled.
 * 
 * Only shows in production environments.
 */
export function SentryHealthCheck() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    // Only check in production
    if (import.meta.env.PROD && !import.meta.env.VITE_SENTRY_DSN) {
      setShow(true);
      
      // Log to console for visibility
      console.error(
        '%c⚠️  PRODUCTION ERROR TRACKING DISABLED',
        'background: #ef4444; color: white; padding: 8px 12px; font-size: 14px; font-weight: bold;',
        '\n\nSentry DSN is not configured. Production errors will NOT be captured.',
        '\n\nTo enable error tracking:',
        '\n1. Set up Sentry at https://sentry.io/',
        '\n2. Add VITE_SENTRY_DSN to your environment variables',
        '\n3. Redeploy your application'
      );
    }
  }, []);

  // Don't show in development or if Sentry is configured
  if (!show) return null;

  return (
    <Alert variant="destructive" className="fixed bottom-4 right-4 max-w-md z-50 shadow-lg">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error Tracking Disabled</AlertTitle>
      <AlertDescription className="text-sm">
        Sentry is not configured. Production errors are not being captured.
        <a 
          href="https://sentry.io/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline block mt-1"
        >
          Set up error tracking
        </a>
      </AlertDescription>
    </Alert>
  );
}
