import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { CreditsManager as CreditsManagerComponent } from "@/features/admin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/formatMoney";
import { format } from "date-fns";
import { adminQueries } from "@/features/admin";
import type { Database } from "@/integrations/supabase/types";

type CreditLedgerWithProfile = Database['public']['Tables']['credits_ledger']['Row'] & {
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const CreditsManager = () => {
  const navigate = useNavigate();

  const { data: creditsHistory, isLoading } = useQuery({
    queryKey: adminQueries.creditsHistory(),
    queryFn: async (): Promise<CreditLedgerWithProfile[]> => {
      const { data, error } = await supabase
        .from('credits_ledger')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      
      <div>
        <h1 className="text-3xl font-bold">Credits Management</h1>
        <p className="text-muted-foreground">Award promotional credits and view transaction history</p>
      </div>

      <CreditsManagerComponent />

      <Card>
        <CardHeader>
          <CardTitle>Recent Credit Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consumer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditsHistory?.map((credit) => (
                  <TableRow key={credit.id}>
                    <TableCell>
                      <div className="font-medium">{credit.profiles?.full_name}</div>
                      <div className="text-xs text-muted-foreground">{credit.profiles?.email}</div>
                    </TableCell>
                    <TableCell className="capitalize">{credit.transaction_type}</TableCell>
                    <TableCell className={credit.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                      {credit.amount > 0 ? '+' : ''}{formatMoney(credit.amount)}
                    </TableCell>
                    <TableCell className="text-sm">{credit.description}</TableCell>
                    <TableCell className="text-sm">
                      {credit.expires_at ? format(new Date(credit.expires_at), 'MMM d, yyyy') : 'Never'}
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(credit.created_at), 'MMM d, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreditsManager;
