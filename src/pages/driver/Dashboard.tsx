import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, TrendingUp, Star, Navigation, Clock } from "lucide-react";

const DriverDashboard = () => {
  const earnings = {
    today: 127.50,
    week: 685.00,
    month: 2840.00,
  };

  const stats = {
    deliveries: 8,
    rating: 4.9,
    onTime: 98,
  };

  const activeRoute = [
    { id: 1, customer: "John D.", address: "123 Main St", status: "pending" },
    { id: 2, customer: "Sarah M.", address: "456 Oak Ave", status: "pending" },
    { id: 3, customer: "Mike R.", address: "789 Pine Rd", status: "pending" },
  ];

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Driver Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome back! You have 8 deliveries today</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Earnings Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Earnings
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${earnings.today.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">100% of delivery fees + tips</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Week
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${earnings.week.toFixed(2)}</div>
              <p className="text-xs text-success mt-1">+12% from last week</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Month
              </CardTitle>
              <Package className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${earnings.month.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.deliveries} deliveries completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Performance Stats */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <Star className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stats.rating}</div>
                  <div className="text-sm text-muted-foreground">Customer Rating</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-success" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stats.onTime}%</div>
                  <div className="text-sm text-muted-foreground">On-Time Delivery</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{stats.deliveries}</div>
                  <div className="text-sm text-muted-foreground">Today's Deliveries</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Route */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Active Route</CardTitle>
            <Button>
              <Navigation className="h-4 w-4 mr-2" />
              Start Navigation
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeRoute.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{stop.customer}</div>
                      <div className="text-sm text-muted-foreground">{stop.address}</div>
                    </div>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default DriverDashboard;
