import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface BoxCodeDisplayProps {
  boxCode: string;
  orderId: string;
  customerName: string;
  deliveryDate: string;
}

export const BoxCodeDisplay = ({ boxCode, orderId, customerName, deliveryDate }: BoxCodeDisplayProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(boxCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Box code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Box Code
          </CardTitle>
          <Badge variant="outline" className="text-lg font-mono px-3 py-1">
            {boxCode}
          </Badge>
        </div>
        <CardDescription>
          Label this box with the code above for easy identification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-muted p-3 rounded-lg space-y-1">
          <p className="text-sm">
            <span className="font-medium">Customer:</span> {customerName}
          </p>
          <p className="text-sm">
            <span className="font-medium">Delivery:</span>{" "}
            {new Date(deliveryDate).toLocaleDateString()}
          </p>
          <p className="text-xs text-muted-foreground">Order ID: {orderId.slice(0, 8)}...</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-full"
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy Box Code
            </>
          )}
        </Button>

        <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
          <p className="text-xs font-medium mb-1">Instructions:</p>
          <ol className="text-xs text-muted-foreground space-y-0.5 ml-4 list-decimal">
            <li>Write the box code clearly on the box</li>
            <li>Include all items for this order in the box</li>
            <li>Deliver to collection point for batch consolidation</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
