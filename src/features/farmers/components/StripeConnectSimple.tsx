import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';

interface StripeStatus {
  connected: boolean;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

interface StripeConnectSimpleProps {
  variant?: 'button' | 'banner';
}

export const StripeConnectSimple = ({ variant = 'button' }: StripeConnectSimpleProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (user) {
      checkStatus();
    }
  }, [user]);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('check-stripe-connect');
      
      if (error) throw error;
      setStatus(data);
    } catch (error) {
      console.error('Error checking Stripe status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Get current session for authorization
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: 'Authentication Required',
          description: 'Please log in to continue',
          variant: 'destructive',
        });
        return;
      }
      
      // Call edge function with authorization header
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Stripe setup opened',
          description: 'Complete the setup in the new tab, then refresh this page.',
        });
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: getErrorMessage(error) || 'Unable to connect to Stripe',
        variant: 'destructive',
      });
    } finally {
      setConnecting(false);
    }
  };

  // Show skeleton while checking initial status to prevent layout shift
  if (loading) {
    return variant === 'button' ? (
      <div className="h-9 w-[180px] bg-muted animate-pulse rounded-md" />
    ) : (
      <div className="h-20 w-full bg-muted animate-pulse rounded-lg" />
    );
  }

  // Already connected + payouts enabled → Show success badge only
  if (status?.payouts_enabled) {
    return variant === 'button' ? (
      <Badge className="bg-green-500 text-white hover:bg-green-600">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Payouts Active
      </Badge>
    ) : (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertTitle>Payouts Active</AlertTitle>
        <AlertDescription>
          Your account is ready to receive payments
        </AlertDescription>
      </Alert>
    );
  }

  // Connected but not fully onboarded → Show "Complete Setup" button
  if (status?.connected && !status.onboarding_complete) {
    return (
      <Button onClick={handleConnect} disabled={connecting} variant="default">
        {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Complete Stripe Setup
      </Button>
    );
  }

  // Not connected → Show single "Connect" button
  return (
    <Button 
      onClick={handleConnect} 
      disabled={connecting} 
      className={variant === 'banner' ? 'w-full' : ''}
    >
      {connecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          Connect my Stripe account
        </>
      )}
    </Button>
  );
};
