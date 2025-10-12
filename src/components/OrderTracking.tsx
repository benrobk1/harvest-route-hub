import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, User, Package, Clock } from "lucide-react";

interface OrderTrackingProps {
  orderId: string;
  status: "ordered" | "farm_pickup" | "en_route" | "delivered";
  driverName?: string;
  driverPhone?: string;
  estimatedTime?: string;
  items: string;
  total: number;
  deliveryAddress?: string;
}

const OrderTracking = ({
  orderId,
  status,
  driverName,
  driverPhone,
  estimatedTime,
  items,
  total,
  deliveryAddress,
}: OrderTrackingProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "ordered":
        return "secondary";
      case "farm_pickup":
        return "default";
      case "en_route":
        return "default";
      case "delivered":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "ordered":
        return "Order Placed";
      case "farm_pickup":
        return "Farm Pickup";
      case "en_route":
        return "En Route";
      case "delivered":
        return "Delivered";
      default:
        return "Processing";
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Order {orderId}</CardTitle>
          <Badge variant={getStatusColor()}>{getStatusText()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{items}</span>
          </div>
          <span className="font-semibold text-foreground">${total.toFixed(2)}</span>
        </div>

        {deliveryAddress && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 mt-0.5" />
            <span>{deliveryAddress}</span>
          </div>
        )}

        {estimatedTime && status === "en_route" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>ETA: {estimatedTime}</span>
          </div>
        )}

        {driverName && (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{driverName}</span>
            </div>
            {driverPhone && (
              <Button variant="outline" size="sm" className="w-full">
                <Phone className="h-4 w-4 mr-2" />
                Call Driver: {driverPhone}
              </Button>
            )}
          </div>
        )}

        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === "ordered" ||
                  status === "farm_pickup" ||
                  status === "en_route" ||
                  status === "delivered"
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">Ordered</span>
            </div>
            <div className="flex-1 h-0.5 bg-border mx-2" />
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === "farm_pickup" || status === "en_route" || status === "delivered"
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">Pickup</span>
            </div>
            <div className="flex-1 h-0.5 bg-border mx-2" />
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === "en_route" || status === "delivered" ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">En Route</span>
            </div>
            <div className="flex-1 h-0.5 bg-border mx-2" />
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === "delivered" ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className="text-xs text-muted-foreground">Delivered</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderTracking;
