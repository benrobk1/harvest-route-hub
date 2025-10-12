import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, TrendingUp, Plus } from "lucide-react";

const FarmerDashboard = () => {
  const earnings = {
    today: 285.30,
    week: 1542.75,
    month: 6820.50,
  };

  const products = [
    { id: 1, name: "Organic Tomatoes", inventory: 45, price: 4.99, status: "active" },
    { id: 2, name: "Fresh Lettuce", inventory: 32, price: 3.49, status: "active" },
    { id: 3, name: "Sweet Corn", inventory: 8, price: 5.99, status: "low" },
  ];

  const recentOrders = [
    { id: "ORD-001", customer: "John D.", items: "3 items", total: 18.47, status: "preparing" },
    { id: "ORD-002", customer: "Sarah M.", items: "5 items", total: 32.95, status: "ready" },
  ];

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Green Valley Farm</h1>
              <p className="text-sm text-muted-foreground">You keep 90% of all sales</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Earnings Overview */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">${earnings.today.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground mt-1">90% goes to you</p>
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
              <p className="text-xs text-success mt-1">+8% from last week</p>
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
              <p className="text-xs text-muted-foreground mt-1">42 orders fulfilled</p>
            </CardContent>
          </Card>
        </div>

        {/* Product Inventory */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Product Inventory</CardTitle>
            <Button variant="outline" size="sm">Manage All</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:border-primary transition-colors"
                >
                  <div>
                    <div className="font-semibold text-foreground">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      ${product.price} per unit
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">{product.inventory} in stock</div>
                      <Badge variant={product.status === "low" ? "destructive" : "secondary"}>
                        {product.status === "low" ? "Low Stock" : "Active"}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-semibold text-foreground">{order.id}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.customer} • {order.items}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-foreground">${order.total.toFixed(2)}</div>
                      <Badge variant={order.status === "ready" ? "default" : "secondary"}>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FarmerDashboard;
