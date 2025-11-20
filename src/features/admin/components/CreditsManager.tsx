import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Loader2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";

export function CreditsManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    consumer_email: "",
    amount: "",
    description: "",
    transaction_type: "promotion" as "promotion" | "referral" | "subscription_reward" | "bonus",
    expires_in_days: "90"
  });

  const handleAwardCredits = async () => {
    if (!formData.consumer_email || !formData.amount || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      // Find consumer by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.consumer_email)
        .single();

      if (profileError || !profile) {
        toast.error("Consumer not found with that email");
        return;
      }

      // Award credits using edge function
      const { data, error } = await supabase.functions.invoke('award-credits', {
        body: {
          consumer_id: profile.id,
          amount: parseFloat(formData.amount),
          description: formData.description,
          transaction_type: formData.transaction_type,
          expires_in_days: parseInt(formData.expires_in_days)
        }
      });

      if (error) throw error;

      toast.success(`Successfully awarded $${formData.amount} credits to ${formData.consumer_email}`);
      
      // Reset form
      setFormData({
        consumer_email: "",
        amount: "",
        description: "",
        transaction_type: "promotion",
        expires_in_days: "90"
      });
    } catch (error: unknown) {
      console.error('Award credits error:', error);
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Award Promotional Credits
        </CardTitle>
        <CardDescription>
          Award credits to consumers for promotions, referrals, or subscription rewards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="consumer_email">Consumer Email *</Label>
          <Input
            id="consumer_email"
            type="email"
            placeholder="consumer@example.com"
            value={formData.consumer_email}
            onChange={(e) => setFormData({ ...formData, consumer_email: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Credit Amount ($) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="25.00"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="transaction_type">Credit Type *</Label>
          <Select
            value={formData.transaction_type}
            onValueChange={(value: typeof formData.transaction_type) =>
              setFormData({ ...formData, transaction_type: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="promotion">Promotion</SelectItem>
              <SelectItem value="referral">Referral Reward</SelectItem>
              <SelectItem value="subscription_reward">Subscription Reward</SelectItem>
              <SelectItem value="bonus">Bonus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expires_in_days">Expires In (days)</Label>
          <Input
            id="expires_in_days"
            type="number"
            min="1"
            placeholder="90"
            value={formData.expires_in_days}
            onChange={(e) => setFormData({ ...formData, expires_in_days: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder="e.g., Holiday promotion credit, Referral bonus, etc."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <Button 
          onClick={handleAwardCredits} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Awarding Credits...
            </>
          ) : (
            "Award Credits"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}