import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { consumerQueries } from "@/features/consumers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Coins } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";

export const SpendingProgressCard = () => {
  const { user } = useAuth();

  const { data: subscription } = useQuery({
    queryKey: consumerQueries.subscription(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('monthly_spend, credits_earned, current_period_start, current_period_end, status')
        .eq('consumer_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Don't show if no subscription or not active
  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  const TARGET_SPEND = 100;
  const CREDIT_REWARD = 10;
  const monthlySpend = Number(subscription.monthly_spend) || 0;
  const progressPercentage = Math.min((monthlySpend / TARGET_SPEND) * 100, 100);
  const remaining = Math.max(TARGET_SPEND - monthlySpend, 0);
  const qualified = monthlySpend >= TARGET_SPEND;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Monthly Spending Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {formatMoney(monthlySpend)} / {formatMoney(TARGET_SPEND)}
            </span>
            <span className="text-muted-foreground">
              {progressPercentage.toFixed(0)}%
            </span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
        </div>

        {qualified ? (
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Coins className="h-4 w-4" />
              <div>
                <p className="font-semibold text-sm">
                  🎉 Qualified for {formatMoney(CREDIT_REWARD)} credit!
                </p>
                <p className="text-xs">
                  Your credit will be available next month
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {formatMoney(remaining)}
              </span>{' '}
              more to earn {formatMoney(CREDIT_REWARD)} credit next month
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Spend $100+ in a month to qualify
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
