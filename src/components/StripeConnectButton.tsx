import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';

interface StripeConnectStatus {
  connected: boolean;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

export const StripeConnectButton = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [status, setStatus] = useState<StripeConnectStatus>({
    connected: false,
    onboarding_complete: false,
    charges_enabled: false,
    payouts_enabled: false,
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setIsChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-stripe-connect', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setStatus(data);
    } catch (error: unknown) {
      console.error('Error checking Stripe Connect status:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    console.log('Starting Stripe Connect onboarding...');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session retrieved:', !!session);
      
      if (!session) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to continue',
          variant: 'destructive',
        });
        return;
      }

      console.log('Invoking stripe-connect-onboard function...');
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          origin: window.location.origin,
          returnPath: '/driver/profile',
        },
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      if (data?.url) {
        console.log('Opening Stripe URL:', data.url);
        window.open(data.url, '_blank');
        toast({
          title: 'Redirecting to Stripe',
          description: 'Complete the onboarding process to receive payouts',
        });
        // Refresh status after a short delay
        setTimeout(() => checkStatus(), 2000);
      } else {
        console.error('No URL in response:', data);
        throw new Error('No onboarding URL received');
      }
    } catch (error: unknown) {
      console.error('Connect error:', error);
      const message = getErrorMessage(error);
      toast({
        title: 'Error',
        description: message || 'Failed to initiate Stripe Connect onboarding',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Setup
            </CardTitle>
            <CardDescription>
              Connect your account to receive payouts
            </CardDescription>
          </div>
          {status.payouts_enabled && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status.connected ? (
          <>
            <p className="text-sm text-muted-foreground">
              Set up your payout account to receive payments for your orders and deliveries.
            </p>
            <Button onClick={handleConnect} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Stripe Account'
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Onboarding</span>
              {status.onboarding_complete ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Incomplete
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Charges Enabled</span>
              {status.charges_enabled ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Payouts Enabled</span>
              {status.payouts_enabled ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {!status.onboarding_complete && (
              <Button onClick={handleConnect} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Complete Onboarding'
                )}
              </Button>
            )}
            <Button onClick={checkStatus} variant="outline" className="w-full">
              Refresh Status
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
