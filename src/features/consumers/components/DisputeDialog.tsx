import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";

const DISPUTE_TYPES = [
  { value: "quality", label: "Product Quality Issue" },
  { value: "missing", label: "Missing Items" },
  { value: "damaged", label: "Damaged Items" },
  { value: "late", label: "Late Delivery" },
  { value: "wrong", label: "Wrong Items Delivered" },
  { value: "other", label: "Other Issue" },
] as const;

interface DisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  consumerId: string;
  totalAmount: number;
}

export function DisputeDialog({
  open,
  onOpenChange,
  orderId,
  consumerId,
  totalAmount,
}: DisputeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [disputeType, setDisputeType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const fileDispute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("disputes").insert({
        order_id: orderId,
        consumer_id: consumerId,
        dispute_type: disputeType,
        description,
        refund_amount: refundAmount ? parseFloat(refundAmount) : null,
        status: "open",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Dispute Filed",
        description: "Your dispute has been submitted. An admin will review it soon.",
      });
      queryClient.invalidateQueries({ queryKey: ["consumer-orders"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to File Dispute",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDisputeType("");
    setDescription("");
    setRefundAmount("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!disputeType || !description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a dispute type and provide a description.",
        variant: "destructive",
      });
      return;
    }

    if (refundAmount && (parseFloat(refundAmount) < 0 || parseFloat(refundAmount) > totalAmount)) {
      toast({
        title: "Invalid Refund Amount",
        description: `Refund amount must be between $0 and $${totalAmount.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }

    fileDispute.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>File a Dispute</DialogTitle>
          <DialogDescription>
            Submit a dispute for this order. Our team will review it and get back to you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dispute-type">What's the issue? *</Label>
            <Select value={disputeType} onValueChange={setDisputeType}>
              <SelectTrigger id="dispute-type">
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {DISPUTE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Please describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              required
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/1000 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-amount">
              Refund Amount (Optional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
              <Input
                id="refund-amount"
                type="number"
                step="0.01"
                min="0"
                max={totalAmount}
                placeholder="0.00"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Max: ${totalAmount.toFixed(2)}
            </p>
          </div>

          <div className="bg-muted p-3 rounded-lg flex gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Your dispute will be reviewed by our team. You'll receive a response within 24-48 hours.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={fileDispute.isPending}>
              {fileDispute.isPending ? "Submitting..." : "Submit Dispute"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
