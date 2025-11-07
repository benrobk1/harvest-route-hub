import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Lazy load the PayoutHistoryChart component
const PayoutHistoryChart = lazy(() => 
  import("@/features/payouts").then(module => ({ 
    default: module.PayoutHistoryChart 
  }))
);

interface LazyChartProps {
  recipientType: 'farmer' | 'driver' | 'lead_farmer_commission';
  title?: string;
}

export const LazyPayoutHistoryChart = ({ recipientType, title = "Payout History" }: LazyChartProps) => {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      }
    >
      <PayoutHistoryChart recipientType={recipientType} />
    </Suspense>
  );
};
