import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, CreditCard, MapPin, Coins, DollarSign } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/formatMoney";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfDay } from "date-fns";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe";
import { PaymentForm } from "@/components/checkout/PaymentForm";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, cartTotal, cartCount } = useCart();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [useCredits, setUseCredits] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>("");

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: credits } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credits_ledger')
        .select('balance_after')
        .eq('consumer_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.balance_after || 0;
    },
    enabled: !!user,
  });

  const { data: marketConfig } = useQuery({
    queryKey: ['market-config', profile?.zip_code],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_configs')
        .select('*')
        .eq('zip_code', profile!.zip_code)
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.zip_code,
  });

  // Generate available delivery dates (next 7 days)
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfDay(new Date()), i + 1);
    const dayName = format(date, 'EEEE');
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return {
      value: dateStr,
      label: format(date, 'EEEE, MMM d'),
      isAvailable: marketConfig?.delivery_days?.includes(dayName) ?? true,
    };
  });

  const deliveryFee = marketConfig?.delivery_fee || 7.50;
  const platformFee = cartTotal * 0.10; // 10% platform fee
  const subtotal = cartTotal;
  
  // Calculate tip
  const tipAmount = tipPercentage > 0 
    ? (subtotal * tipPercentage / 100) 
    : (customTip ? parseFloat(customTip) || 0 : 0);
  
  const availableCreditsAmount = credits || 0;
  const creditsToUse = useCredits ? Math.min(availableCreditsAmount, subtotal + deliveryFee + tipAmount) : 0;
  const total = Math.max(0, subtotal + deliveryFee + tipAmount - creditsToUse);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!user || !cart || !selectedDate) {
        throw new Error('Missing required data');
      }

      // Call checkout edge function
      const { data, error } = await supabase.functions.invoke('checkout', {
        body: {
          cart_id: cart.id,
          delivery_date: selectedDate,
          use_credits: useCredits,
          credits_amount: creditsToUse,
          tip_amount: tipAmount,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        const errorMessages: { [key: string]: string } = {
          'INSUFFICIENT_INVENTORY': data.message || 'Some products are out of stock',
          'BELOW_MINIMUM_ORDER': data.message || `Minimum order is ${formatMoney(data.minimum)}`,
          'CUTOFF_PASSED': data.message || 'Order cutoff time has passed',
          'INVALID_DELIVERY_DATE': data.message || 'Invalid delivery date selected',
          'MISSING_PROFILE_INFO': data.message || 'Please complete your profile information',
          'NO_MARKET_CONFIG': data.message || 'Delivery not available in your area',
        };

        throw new Error(errorMessages[data.error] || data.message || 'Order failed');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.client_secret) {
        setClientSecret(data.client_secret);
        setPaymentIntentId(data.payment_intent_id);
      } else {
        // Order completed without payment (fully covered by credits)
        toast({
          title: 'Order placed!',
          description: `Your order has been confirmed for ${format(new Date(data.delivery_date), 'MMM d')}`,
        });
        navigate('/consumer/orders');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Order failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handlePaymentSuccess = () => {
    toast({
      title: 'Payment successful!',
      description: 'Your order has been confirmed.',
    });
    navigate('/consumer/orders');
  };

  if (!cart || cartCount === 0) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Button onClick={() => navigate('/consumer/shop')}>Continue Shopping</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-earth p-4">
      <div className="container max-w-4xl mx-auto py-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/consumer/shop')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Shop
        </Button>

        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium">{profile?.full_name}</p>
                  <p className="text-muted-foreground">{profile?.delivery_address}</p>
                  <p className="text-muted-foreground">ZIP: {profile?.zip_code}</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/consumer/profile')}>
                  Change Address
                </Button>
              </CardContent>
            </Card>

            {/* Delivery Date */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Delivery Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedDate} onValueChange={setSelectedDate}>
                  <div className="space-y-3">
                    {availableDates.map((date) => (
                      <div key={date.value} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={date.value}
                          id={date.value}
                          disabled={!date.isAvailable}
                        />
                        <Label
                          htmlFor={date.value}
                          className={!date.isAvailable ? 'text-muted-foreground line-through' : ''}
                        >
                          {date.label}
                          {!date.isAvailable && ' (Not available)'}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Driver Tip */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Driver Tip (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  100% of your tip goes directly to your delivery driver
                </p>
                
                {/* Preset Tip Percentages */}
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 20].map((percent) => (
                    <Button
                      key={percent}
                      variant={tipPercentage === percent ? "default" : "outline"}
                      onClick={() => {
                        setTipPercentage(percent);
                        setCustomTip("");
                      }}
                      className="w-full"
                    >
                      {percent}%
                    </Button>
                  ))}
                  <Button
                    variant={customTip ? "default" : "outline"}
                    onClick={() => {
                      setTipPercentage(0);
                      setCustomTip("0");
                    }}
                  >
                    Custom
                  </Button>
                </div>

                {/* Custom Tip Input */}
                {(tipPercentage === 0 || customTip) && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-tip">Custom Tip Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input
                        id="custom-tip"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={customTip}
                        onChange={(e) => {
                          setCustomTip(e.target.value);
                          setTipPercentage(0);
                        }}
                        className="pl-7"
                      />
                    </div>
                  </div>
                )}

                {tipAmount > 0 && (
                  <p className="text-sm font-medium text-primary">
                    Tip: {formatMoney(tipAmount)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {availableCreditsAmount > 0 && (
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary" />
                        <span className="font-medium">Available Credits</span>
                      </div>
                      <span className="font-bold">{formatMoney(availableCreditsAmount)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="use-credits-payment"
                        checked={useCredits}
                        onCheckedChange={(checked) => setUseCredits(checked as boolean)}
                      />
                      <label
                        htmlFor="use-credits-payment"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Use credits for this order
                      </label>
                    </div>
                    {useCredits && creditsToUse > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {formatMoney(creditsToUse)} will be applied to this order
                      </p>
                    )}
                  </div>
                )}
                
                {clientSecret && total > 0 ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm onSuccess={handlePaymentSuccess} amount={total} />
                  </Elements>
                ) : total === 0 ? (
                  <p className="text-sm text-green-600 font-medium">
                    Order fully covered by credits - no payment required!
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Complete order details to proceed with payment
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{cartCount} items</p>
                  <div className="space-y-2">
                    {cart.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.products.name} x{item.quantity}
                        </span>
                        <span>{formatMoney(item.quantity * Number(item.unit_price))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee</span>
                    <span>{formatMoney(deliveryFee)}</span>
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Driver Tip</span>
                      <span>{formatMoney(tipAmount)}</span>
                    </div>
                  )}
                  {useCredits && creditsToUse > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Credits Applied
                      </span>
                      <span>-{formatMoney(creditsToUse)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    />
                    <label
                      htmlFor="terms"
                      className="text-sm leading-tight cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I agree to the{' '}
                      <Link to="/terms" target="_blank" className="text-primary hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>
                </div>

                {!clientSecret && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => createOrder.mutate()}
                    disabled={!selectedDate || !termsAccepted || createOrder.isPending}
                  >
                    {createOrder.isPending ? 'Processing...' : total === 0 ? 'Complete Order' : 'Proceed to Payment'}
                  </Button>
                )}

                {!selectedDate && (
                  <p className="text-sm text-muted-foreground text-center">
                    Please select a delivery date
                  </p>
                )}
                
                {!termsAccepted && selectedDate && (
                  <p className="text-sm text-muted-foreground text-center">
                    Please accept the terms to continue
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
