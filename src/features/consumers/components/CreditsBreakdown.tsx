import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Coins, TrendingUp, Calendar } from "lucide-react";
import { formatMoney } from "@/lib/formatMoney";
import { calculateAvailableNextMonth } from "@/lib/creditsHelpers";
import { consumerQueries } from "@/features/consumers";
import type { Database } from "@/integrations/supabase/types";

type CreditsLedgerEntry = Database['public']['Tables']['credits_ledger']['Row'];

export const CreditsBreakdown = () => {
  const { user } = useAuth();

  const { data: creditsData } = useQuery({
    queryKey: consumerQueries.creditsBreakdown(user?.id || ''),
    queryFn: async (): Promise<{
      currentBalance: number;
      monthlySpend: number;
      earnedThisMonth: number;
      availableNextMonth: number;
      recentTransactions: CreditsLedgerEntry[];
    }> => {
      // Get current subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('consumer_id', user?.id)
        .single();

      // Get credits ledger
      const { data: ledger } = await supabase
        .from('credits_ledger')
        .select('*')
        .eq('consumer_id', user?.id)
        .order('created_at', { ascending: false });

      const currentBalance = ledger?.[0]?.balance_after || 0;
      const monthlySpend = subscription?.monthly_spend || 0;
      
      // Calculate credits earned this month (using helper)
      const earnedThisMonth = calculateAvailableNextMonth(ledger || []);

      // Credits available next month (earned this month)
      const availableNextMonth = earnedThisMonth;

      return {
        currentBalance,
        monthlySpend,
        earnedThisMonth,
        availableNextMonth,
        recentTransactions: ledger?.slice(0, 5) || []
      };
    },
    enabled: !!user?.id
  });

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          Credits & Rewards
        </CardTitle>
        <CardDescription>
          Earn $10 credit for every order over $100
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="breakdown">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span>View Credit Details</span>
                <span className="text-sm text-muted-foreground">
                  Balance: {formatMoney(creditsData?.currentBalance || 0)}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                {/* Current Month Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Monthly Spend</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {formatMoney(creditsData?.monthlySpend || 0)}
                    </p>
                  </div>
                  
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-muted-foreground">Earned This Month</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatMoney(creditsData?.earnedThisMonth || 0)}
                    </p>
                  </div>
                </div>

                {/* Earning Rate */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium mb-2">How Credits Work:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Earn $10 credit for each order $100+</li>
                    <li>• Credits available next month after earning</li>
                    <li>• Credits expire 30 days from issue date</li>
                    <li>• Automatically applied at checkout</li>
                  </ul>
                </div>

                {/* Next Month Preview */}
                {(creditsData?.availableNextMonth || 0) > 0 && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <Calendar className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-600">
                        Next Month Preview
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(creditsData.availableNextMonth)} credit will be available
                      </p>
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                {creditsData?.recentTransactions && creditsData.recentTransactions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Activity:</p>
                    <div className="space-y-2">
                      {creditsData.recentTransactions.map((txn) => (
                        <div key={txn.id} className="flex justify-between items-center text-xs p-2 bg-muted rounded">
                          <span className="text-muted-foreground">{txn.description}</span>
                          <span className={txn.transaction_type === 'earned' ? 'text-green-600 font-medium' : 'text-foreground font-medium'}>
                            {txn.transaction_type === 'earned' ? '+' : ''}{formatMoney(Number(txn.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
