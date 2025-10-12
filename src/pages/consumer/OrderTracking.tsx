import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OrderTracking from "@/components/OrderTracking";
import PreApprovedMessaging from "@/components/PreApprovedMessaging";
import logo from "@/assets/blue-harvests-logo.jpeg";

const ConsumerOrderTracking = () => {
  const navigate = useNavigate();

  // Mock order data - in real app, this would come from backend
  const orders = [
    {
      orderId: "BH-001234",
      status: "en_route" as const,
      driverName: "Mike Johnson",
      driverPhone: "(555) 234-5678",
      estimatedTime: "15 minutes",
      items: "5 items from Green Valley Farm",
      total: 42.5,
      deliveryAddress: "123 Main St, Anytown, NY 12345",
      farmerName: "Green Valley Farm",
    },
    {
      orderId: "BH-001189",
      status: "delivered" as const,
      driverName: "Sarah Martinez",
      driverPhone: "(555) 345-6789",
      items: "3 items from Sunny Acres",
      total: 28.75,
      deliveryAddress: "123 Main St, Anytown, NY 12345",
      farmerName: "Sunny Acres",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-earth">
      <header className="bg-white border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/consumer/shop")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Blue Harvests" className="h-12 object-contain" />
            <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.orderId} className="space-y-4">
              <OrderTracking
                orderId={order.orderId}
                status={order.status}
                driverName={order.driverName}
                driverPhone={order.driverPhone}
                estimatedTime={order.estimatedTime}
                items={order.items}
                total={order.total}
                deliveryAddress={order.deliveryAddress}
              />
              
              <div className="grid md:grid-cols-2 gap-4">
                <PreApprovedMessaging
                  recipientType="driver"
                  recipientName={order.driverName}
                  orderId={order.orderId}
                />
                <PreApprovedMessaging
                  recipientType="farmer"
                  recipientName={order.farmerName}
                  orderId={order.orderId}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ConsumerOrderTracking;
