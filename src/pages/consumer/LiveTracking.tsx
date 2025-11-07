import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OrderTracking from "@/components/OrderTracking";
import { Skeleton } from "@/components/ui/skeleton";
import logo from "@/assets/blue-harvests-logo.jpeg";
import { useActiveOrder } from "@/features/orders";
import { OrderWithDetails } from "@/features/orders";
import { EmptyOrderState } from "@/features/consumers";
import { mapOrderStatus, formatOrderItems, formatEstimatedTime } from "@/lib/orderHelpers";

const LiveTracking = () => {
  const navigate = useNavigate();
  const { activeOrder, isLoading } = useActiveOrder();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-earth">
        <header className="bg-white border-b shadow-soft">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  const typedOrder = activeOrder as OrderWithDetails | null;
  const driver = typedOrder?.delivery_batches?.profiles;
  const deliveryAddress = typedOrder?.profiles;

  return (
    <div className="min-h-screen bg-gradient-earth pb-20 md:pb-8">
      <header className="bg-white border-b shadow-soft sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/consumer/shop")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Blue Harvests" className="h-12 object-contain" />
            <h1 className="text-2xl font-bold text-foreground">Live Tracking</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!typedOrder ? (
          <EmptyOrderState />
        ) : (
          <OrderTracking
            orderId={typedOrder.id.slice(0, 8)}
            status={mapOrderStatus(typedOrder.status)}
            driverName={driver?.full_name}
            driverPhone={driver?.phone}
            estimatedTime={formatEstimatedTime(typedOrder.delivery_batches?.estimated_duration_minutes)}
            items={formatOrderItems(typedOrder.order_items || [])}
            total={Number(typedOrder.total_amount)}
            deliveryAddress={deliveryAddress ? 
              `${deliveryAddress.street_address}, ${deliveryAddress.city}, ${deliveryAddress.state} ${deliveryAddress.zip_code}` 
              : 'Address not available'
            }
          />
        )}
      </main>
    </div>
  );
};

export default LiveTracking;
