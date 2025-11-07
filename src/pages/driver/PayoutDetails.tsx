import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, DollarSign } from "lucide-react";
import { PayoutHistoryChart, PayoutDetailsTable } from "@/features/payouts";

const PayoutDetails = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate("/driver/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="h-6 w-6 text-primary" />
                  Payout Details
                </h1>
                <p className="text-sm text-muted-foreground">
                  View your earnings history and payment information
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Payment Overview</CardTitle>
            <CardDescription>
              Track your earnings from delivery fees and tips
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              All payments are processed through Stripe Connect. Ensure your payment setup is complete in your profile to receive payouts.
            </p>
          </CardContent>
        </Card>

        <PayoutHistoryChart recipientType="driver" />
        <PayoutDetailsTable recipientType="driver" />
      </main>
    </div>
  );
};

export default PayoutDetails;
