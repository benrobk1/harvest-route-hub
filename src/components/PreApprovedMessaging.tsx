import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle } from "lucide-react";

interface PreApprovedMessagingProps {
  recipientType: "farmer" | "driver";
  recipientName: string;
  orderId: string;
}

const PreApprovedMessaging = ({
  recipientType,
  recipientName,
  orderId,
}: PreApprovedMessagingProps) => {
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  const messages = {
    farmer: [
      "Product was excellent quality!",
      "Really great, thank you!",
      "Product was overripe",
      "Product was damaged",
      "Missing items from order",
      "Would like to reorder soon",
    ],
    driver: [
      "Great delivery service!",
      "Driver was very professional",
      "Delivery was late",
      "Could not find delivery location",
      "Items were damaged during delivery",
      "Excellent communication",
    ],
  };

  const handleSendMessage = (message: string) => {
    setSelectedMessage(message);
    toast({
      title: "Message Sent",
      description: `Your message has been sent to ${recipientName}`,
    });
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Message {recipientType === "farmer" ? "Farmer" : "Driver"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground mb-3">
          Order {orderId} - {recipientName}
        </div>
        <div className="space-y-2">
          {messages[recipientType].map((message, index) => (
            <Button
              key={index}
              variant={selectedMessage === message ? "default" : "outline"}
              className="w-full text-left justify-start h-auto py-3 px-4"
              onClick={() => handleSendMessage(message)}
            >
              {message}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PreApprovedMessaging;
