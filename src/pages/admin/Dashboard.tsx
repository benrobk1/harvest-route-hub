import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Truck, Sprout, DollarSign, TrendingUp, MapPin } from "lucide-react";

const AdminDashboard = () => {
  const metrics = {
    consumers: 1247,
    drivers: 83,
    farmers: 42,
    revenue: 15840.50,
    orders: 342,
    activeDeliveries: 18,
  };

  const recentActivity = [
    { id: 1, type: "order", text: "New order from ZIP 10001", time: "2 min ago", status: "new" },
    { id: 2, type: "driver", text: "Driver completed route #D-042", time: "8 min ago", status: "completed" },
    { id: 3, type: "farmer", text: "Green Valley Farm added 5 products", time: "15 min ago", status: "info" },
  ];

  const liveDrivers = [
    { id: 1, name: "Mike R.", route: "Route #D-042", deliveries: "3/8", status: "active" },
    { id: 2, name: "Sarah K.", route: "Route #D-043", deliveries: "5/10", status: "active" },
    { id: 3, name: "Tom B.", route: "Route #D-044", deliveries: "1/6", status: "active" },
  ];

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Management Portal</h1>
          <p className="text-sm text-muted-foreground">Real-time business intelligence and operations</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Key Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Consumers
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{metrics.consumers}</div>
              <p className="text-xs text-success mt-1">+12% this month</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Delivery Drivers
              </CardTitle>
              <Truck className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{metrics.drivers}</div>
              <p className="text-xs text-muted-foreground mt-1">{metrics.activeDeliveries} active now</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Partner Farms
              </CardTitle>
              <Sprout className="h-4 w-4 text-earth" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{metrics.farmers}</div>
              <p className="text-xs text-success mt-1">+3 this week</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Revenue (30d)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${metrics.revenue.toFixed(2)}</div>
              <p className="text-xs text-success mt-1">+18% vs last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Live Delivery Tracking */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Live Delivery Tracking</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {metrics.activeDeliveries} drivers currently on route
              </p>
            </div>
            <Badge variant="default" className="bg-success">
              <MapPin className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {liveDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div>
                    <div className="font-semibold text-foreground">{driver.name}</div>
                    <div className="text-sm text-muted-foreground">{driver.route}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
                        {driver.deliveries} completed
                      </div>
                      <Badge variant="default" className="bg-success">Active</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between pb-4 border-b last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">{activity.text}</div>
                      <div className="text-xs text-muted-foreground mt-1">{activity.time}</div>
                    </div>
                    <Badge variant={activity.status === "new" ? "default" : "secondary"}>
                      {activity.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Business Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Customer LTV</div>
                  <div className="text-2xl font-bold text-foreground">$428</div>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Avg Order Value</div>
                  <div className="text-2xl font-bold text-foreground">$46.32</div>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Monthly Churn</div>
                  <div className="text-2xl font-bold text-foreground">2.8%</div>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
