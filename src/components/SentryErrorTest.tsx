import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { captureException, captureMessage } from '@/lib/sentry';
import { toast } from 'sonner';

/**
 * SENTRY ERROR TEST COMPONENT
 * 
 * Development tool to verify Sentry error tracking is working.
 * Remove this component in production.
 * 
 * Setup Instructions:
 * 1. Create a Sentry project at https://sentry.io/
 * 2. Copy your DSN from Sentry dashboard
 * 3. Add to .env: VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
 * 4. Restart dev server
 * 5. Click test buttons below and check Sentry dashboard
 */
export function SentryErrorTest() {
  const [testCount, setTestCount] = useState(0);
  const sentryConfigured = !!import.meta.env.VITE_SENTRY_DSN;

  const testManualError = () => {
    try {
      throw new Error('Test Error: Manual exception capture');
    } catch (error) {
      captureException(error);
      toast.success('Error sent to Sentry');
      setTestCount(prev => prev + 1);
    }
  };

  const testMessage = () => {
    captureMessage('Test Message: Sentry integration working', 'info');
    toast.success('Message sent to Sentry');
    setTestCount(prev => prev + 1);
  };

  const testUnhandledError = () => {
    // This will be caught by Sentry's global error handler
    setTimeout(() => {
      throw new Error('Test Error: Unhandled exception');
    }, 100);
    toast.success('Unhandled error triggered (check console & Sentry)');
    setTestCount(prev => prev + 1);
  };

  const testAsyncError = async () => {
    try {
      await Promise.reject(new Error('Test Error: Promise rejection'));
    } catch (error) {
      captureException(error);
      toast.success('Async error sent to Sentry');
      setTestCount(prev => prev + 1);
    }
  };

  if (!sentryConfigured) {
    return (
      <Card className="border-warning bg-warning/10">
        <CardHeader>
          <CardTitle className="text-warning">⚠️ Sentry Not Configured</CardTitle>
          <CardDescription>
            Error tracking is disabled. To enable:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal list-inside space-y-1">
            <li>Create project at <a href="https://sentry.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">sentry.io</a></li>
            <li>Copy your DSN from the Sentry dashboard</li>
            <li>Add to .env: <code className="bg-muted px-1 py-0.5 rounded">VITE_SENTRY_DSN=your-dsn</code></li>
            <li>Restart development server</li>
          </ol>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-primary">✅ Sentry Error Tracking Enabled</CardTitle>
        <CardDescription>
          Test error capture with the buttons below. Check your Sentry dashboard to verify errors are being tracked.
          {testCount > 0 && ` (${testCount} test${testCount > 1 ? 's' : ''} triggered)`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={testManualError} variant="outline" size="sm">
            Test Manual Error
          </Button>
          <Button onClick={testMessage} variant="outline" size="sm">
            Test Message
          </Button>
          <Button onClick={testUnhandledError} variant="outline" size="sm">
            Test Unhandled Error
          </Button>
          <Button onClick={testAsyncError} variant="outline" size="sm">
            Test Async Error
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          💡 <strong>Next steps:</strong> Check your{' '}
          <a 
            href="https://sentry.io/organizations/your-org/issues/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Sentry Dashboard
          </a>
          {' '}to see captured errors. Remove this component before deploying to production.
        </p>
      </CardContent>
    </Card>
  );
}
