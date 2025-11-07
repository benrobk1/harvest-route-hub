import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, TrendingUp, Gift } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/formatMoney";

export const SubscriptionManager = () => {
  const { subscriptionStatus, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (enableTrial: boolean = false) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { enable_trial: enableTrial }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Opening Stripe Checkout",
          description: "Complete your subscription in the new window",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await refreshSubscription();
    setIsLoading(false);
    toast({
      title: "Status Updated",
      description: "Subscription status refreshed",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Monthly Subscription
            </CardTitle>
            <CardDescription>
              $10/month - Earn $10 credit for every $100 spent
            </CardDescription>
          </div>
          {subscriptionStatus?.subscribed && (
            <Badge variant="default">Active</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!subscriptionStatus?.subscribed ? (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Subscription Benefits
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>$10/month subscription fee</li>
                <li>Earn $10 credit automatically for every $100 you spend</li>
                <li>Credits expire after 6 months</li>
                <li>Track your monthly spending progress</li>
              </ul>
            </div>
            <Button 
              onClick={() => handleSubscribe(true)} 
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? "Loading..." : "Subscribe Now - $10/month"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptionStatus.is_trialing && subscriptionStatus.trial_end && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  🎉 Free Trial Active
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your trial ends on {new Date(subscriptionStatus.trial_end).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Available Credits</span>
                <span className="text-2xl font-bold text-primary">
                  {formatMoney(subscriptionStatus.credits_available)}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Progress to Next $10 Credit
                  </span>
                  <span className="font-medium">
                    {formatMoney(subscriptionStatus.monthly_spend)} / {formatMoney(100)}
                  </span>
                </div>
                <Progress value={subscriptionStatus.progress_to_credit} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {formatMoney(Math.max(0, 100 - subscriptionStatus.monthly_spend))} more to earn $10 credit
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={isLoading}
                variant="outline"
                className="flex-1"
              >
                Refresh Status
              </Button>
            </div>

            {subscriptionStatus.subscription_end && (
              <p className="text-xs text-muted-foreground text-center">
                Next billing: {new Date(subscriptionStatus.subscription_end).toLocaleDateString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
