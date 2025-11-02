import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

interface DemoDataStatusProps {
  stats: {
    usersCreated: number;
    ordersGenerated: number;
    batchesCreated: number;
    productsCreated: number;
    creditsAwarded: number;
    subscriptionsCreated: number;
  };
}

export function DemoDataStatus({ stats }: DemoDataStatusProps) {
  const statusItems = [
    { label: "Users", count: stats.usersCreated, total: 22 },
    { label: "Orders", count: stats.ordersGenerated, total: 38 },
    { label: "Batches", count: stats.batchesCreated, total: 2 },
    { label: "Products", count: stats.productsCreated, total: 120 },
    { label: "Credits", count: stats.creditsAwarded, total: 12 },
    { label: "Subscriptions", count: stats.subscriptionsCreated, total: 5 },
  ];

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Demo Data Loaded Successfully
        </CardTitle>
        <CardDescription>
          All demo accounts and data are ready for your YC presentation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusItems.map((item) => (
            <div key={item.label} className="text-center">
              <Badge variant="secondary" className="mb-2">
                {item.count}/{item.total}
              </Badge>
              <div className="text-sm text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
