import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertCircle, Clock, RefreshCw } from "lucide-react";

interface StripeStatus {
  connected: boolean;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

export const StripeConnectStatusBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!user) return;
    
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-stripe-connect');
      if (error) throw error;
      setStatus(data as StripeStatus);
    } catch (error) {
      console.error('Failed to check Stripe status:', error);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const getStatusDisplay = () => {
    if (!status?.connected) {
      return {
        variant: 'destructive' as const,
        icon: XCircle,
        title: 'Payouts Blocked',
        message: 'Connect your Stripe account to receive payments',
        action: 'Connect Stripe Account',
        actionVariant: 'destructive' as const
      };
    }
    
    if (!status.onboarding_complete) {
      return {
        variant: 'default' as const,
        icon: AlertCircle,
        title: 'Onboarding Pending',
        message: 'Complete your Stripe onboarding to enable payouts',
        action: 'Complete Onboarding',
        actionVariant: 'default' as const
      };
    }
    
    if (!status.payouts_enabled) {
      return {
        variant: 'default' as const,
        icon: Clock,
        title: 'Payouts Under Review',
        message: 'Stripe is reviewing your account. This usually takes 1-2 business days',
        action: 'Refresh Status',
        actionVariant: 'outline' as const
      };
    }
    
    return {
      variant: 'default' as const,
      icon: CheckCircle,
      title: 'Payouts Active',
      message: 'Your account is ready to receive payments',
      action: null,
      actionVariant: null
    };
  };

  if (loading && !status) {
    return null;
  }

  const statusInfo = getStatusDisplay();
  const Icon = statusInfo.icon;
  const isActive = status?.payouts_enabled;

  return (
    <Alert 
      variant={statusInfo.variant} 
      className={`mb-6 ${isActive ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}
    >
      <Icon className={`h-5 w-5 ${isActive ? 'text-green-600' : ''}`} />
      <AlertTitle className="text-lg font-semibold">{statusInfo.title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between mt-2">
        <span>{statusInfo.message}</span>
        {statusInfo.action && (
          <Button
            size="sm"
            variant={statusInfo.actionVariant || 'default'}
            onClick={() => {
              if (statusInfo.title === 'Payouts Under Review') {
                checkStatus();
              } else {
                navigate('/profile');
              }
            }}
            disabled={checking}
          >
            {checking && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            {statusInfo.action}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};
