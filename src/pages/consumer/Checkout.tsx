import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/LoadingButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Calendar, CreditCard, MapPin, Coins, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react";
import { useCart } from "@/features/cart";
import { useAuth } from "@/contexts/AuthContext";
import { consumerQueries } from "@/features/consumers";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/formatMoney";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, startOfDay } from "date-fns";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe";
import { PaymentForm } from "@/components/checkout/PaymentForm";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";
import PriceBreakdownDrawer from "@/components/PriceBreakdownDrawer";
import type { CheckoutRequest } from "@/contracts/checkout";
import { DELIVERY_FEE_USD } from "@/config/constants";

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, cartTotal, cartCount } = useCart();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [useCredits, setUseCredits] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [tipPercentage, setTipPercentage] = useState<number>(0);
  const [customTip, setCustomTip] = useState<string>("");
  const [showDateError, setShowDateError] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);

  const { data: profile } = useQuery({
    queryKey: consumerQueries.profile(user?.id),
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
    queryKey: consumerQueries.credits(user?.id || ''),
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
    queryKey: consumerQueries.marketConfig(profile?.zip_code),
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

  // Auto-select a valid delivery date when market config loads or selection becomes invalid
  useEffect(() => {
    if (!marketConfig) return;
    const isCurrentValid = selectedDate && availableDates.find(d => d.value === selectedDate)?.isAvailable;
    if (!isCurrentValid) {
      const first = availableDates.find(d => d.isAvailable);
      if (first) setSelectedDate(first.value);
    }
  }, [marketConfig, selectedDate, availableDates]);

  const deliveryFee = DELIVERY_FEE_USD;
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
      if (!selectedDate) {
        setShowDateError(true);
        throw new Error('Please select a delivery date');
      }

      if (!termsAccepted) {
        setShowTermsError(true);
        throw new Error('Please accept the terms and conditions');
      }

      if (!user || !cart) {
        throw new Error('Missing required data');
      }

      // Validate selected date against allowed delivery days
      const selected = availableDates.find(d => d.value === selectedDate);
      if (!selected || !selected.isAvailable) {
        const dayLabel = selected ? selected.label.split(',')[0] : 'selected day';
        const allowed = (marketConfig?.delivery_days || []).join(', ');
        // Auto-select next available date to prevent hard failure
        const next = availableDates.find(d => d.isAvailable);
        if (next) {
          setSelectedDate(next.value);
        }
        throw new Error(`Delivery not available on ${dayLabel}. Available days: ${allowed}.`);
      }

      // Call checkout edge function with validated contract payload
      // Send a timezone-safe ISO date at noon UTC to avoid day shifts
      const deliveryDateTime = `${selectedDate}T12:00:00Z`;
      
      const checkoutPayload: CheckoutRequest = {
        cart_id: cart.id,
        delivery_date: deliveryDateTime,
        use_credits: useCredits,
        tip_amount: tipAmount,
      };

      const { data, error } = await supabase.functions.invoke('checkout', {
        body: checkoutPayload,
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
        setOrderId(data.order_id);
      } else {
        // Order completed without payment (fully covered by credits)
        toast({
          title: '✅ Order Placed Successfully!',
          description: 'Your order has been confirmed.',
          duration: 3000,
        });
        navigate(`/consumer/order-success/${data.order_id}`);
      }
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Order Failed',
        description: error.message,
        variant: 'destructive',
        duration: 6000,
      });
    },
  });

  const handlePaymentSuccess = () => {
    toast({
      title: '✅ Order Placed Successfully!',
      description: 'Your order has been confirmed.',
      duration: 3000,
    });
    if (orderId) {
      navigate(`/consumer/order-success/${orderId}`);
    } else {
      navigate('/consumer/orders');
    }
  };

  // Check if profile is missing required address info
  const missingAddressFields = profile && (!profile.street_address || !profile.city || !profile.state || !profile.zip_code);

  if (missingAddressFields) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Complete Your Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Please complete your full delivery address before placing an order:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              {!profile?.street_address && <li>Street address</li>}
              {!profile?.city && <li>City</li>}
              {!profile?.state && <li>State</li>}
              {!profile?.zip_code && <li>ZIP code</li>}
            </ul>
            <Button onClick={() => navigate('/consumer/profile')} className="w-full">
              Go to Profile
            </Button>
            <Button variant="outline" onClick={() => navigate('/consumer/shop')} className="w-full">
              Back to Shop
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If market config is missing for a provided ZIP, show a clear message
  if (profile && profile.zip_code && marketConfig === null) {
    return (
      <div className="min-h-screen bg-gradient-earth flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Delivery Unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              We don’t currently deliver to ZIP {profile.zip_code}. Update your address to check other areas.
            </p>
            <Button onClick={() => navigate('/consumer/profile')} className="w-full">
              Change Address
            </Button>
            <Button variant="outline" onClick={() => navigate('/consumer/shop')} className="w-full">
              Back to Shop
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // While loading profile or marketConfig, show skeletons
  if (!profile || marketConfig === undefined) {
    return (
      <div className="min-h-screen bg-gradient-earth p-4">
        <div className="container max-w-4xl mx-auto py-8">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="h-9 w-48 mb-8" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-32" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            </div>
            <div>
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="max-w-3xl mx-auto space-y-6">
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
                  <p className="text-muted-foreground">{profile?.street_address}</p>
                  {profile?.address_line_2 && (
                    <p className="text-muted-foreground">{profile.address_line_2}</p>
                  )}
                  <p className="text-muted-foreground">
                    {profile?.city}, {profile?.state} {profile?.zip_code}
                  </p>
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
                <p className="text-sm text-muted-foreground">
                  Orders close at {marketConfig?.cutoff_time?.slice(0, 5) || '11:59 PM'} daily. 
                  Farmer drop-off: 1-3 PM next day.
                </p>
              </CardHeader>
              <CardContent>
                <RadioGroup value={selectedDate} onValueChange={(date) => {
                  setSelectedDate(date);
                  setShowDateError(false);
                }}>
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
                          {selectedDate === date.value && date.isAvailable && (
                            <CheckCircle2 className="inline-block ml-2 h-4 w-4 text-green-500" />
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                {showDateError && !selectedDate && (
                  <p className="text-sm text-destructive flex items-center gap-2 mt-3">
                    <AlertCircle className="h-4 w-4" />
                    Please select a delivery date to proceed
                  </p>
                )}
                {selectedDate && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Delivery scheduled for {availableDates.find(d => d.value === selectedDate)?.label}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{cartCount} items</p>
                  <div className="space-y-2">
                    {cart.items.map((item) => (
                      <div key={item.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>
                            {item.products.name} x{item.quantity}
                          </span>
                          <span>{formatMoney(item.quantity * Number(item.unit_price))}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => navigate(`/farm/${item.products.farm_profiles.id}`)}
                            className="text-xs text-primary hover:underline"
                          >
                            {item.products.farm_profiles.farm_name}
                          </button>
                          <PriceBreakdownDrawer 
                            price={Number(item.unit_price)}
                            farmName={item.products.farm_profiles.farm_name}
                            isCheckout
                          />
                        </div>
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
                    <span className="flex items-center gap-1">
                      Delivery Fee
                      <span className="text-xs text-muted-foreground">(100% to driver)</span>
                    </span>
                    <span>{formatMoney(deliveryFee)}</span>
                  </div>
                  {tipAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1">
                        Driver Tip
                        <span className="text-xs text-muted-foreground">(100% to driver)</span>
                      </span>
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
                <div>
                  <Label className="text-sm font-medium mb-2 block">Tip Percentage</Label>
                  <div className="grid grid-cols-3 gap-2">
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
                  </div>
                </div>

                {/* Custom Tip Input */}
                <div className="space-y-2">
                  <Label htmlFor="custom-tip">Or Custom Amount</Label>
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
                {/* 
                  PRIVACY & SECURITY MESSAGE:
                  WHY addresses are hidden until pickup:
                  1. Privacy protection - consumers' home addresses are sensitive data
                  2. RLS (Row Level Security) enforces server-side access control
                  3. Drivers only see addresses when geographically nearby (prevents stalking/abuse)
                  4. Database trigger auto-updates visibility based on driver proximity
                  
                  This is part of security hardening - building trust at checkout conversion point.
                */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
                  <svg className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <p className="text-sm text-muted-foreground">
                    Your payment info is encrypted. Your address is only shared with your assigned driver when they're nearby.
                  </p>
                </div>
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
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => {
                        setTermsAccepted(checked as boolean);
                        setShowTermsError(false);
                      }}
                      className={showTermsError && !termsAccepted ? 'border-destructive' : ''}
                    />
                    <label
                      htmlFor="terms"
                      className={`text-sm leading-tight cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        showTermsError && !termsAccepted ? 'text-destructive' : ''
                      }`}
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
                  {showTermsError && !termsAccepted && (
                    <p className="text-sm text-destructive flex items-center gap-2 ml-6">
                      <AlertCircle className="h-4 w-4" />
                      You must accept the terms to continue
                    </p>
                  )}
                </div>

                {!clientSecret && (
                  <LoadingButton
                    className="w-full"
                    size="lg"
                    onClick={() => createOrder.mutate()}
                    isLoading={createOrder.isPending}
                    loadingText="Creating order..."
                    disabled={!selectedDate || !termsAccepted}
                  >
                    {total === 0 ? 'Complete Order' : 'Proceed to Payment'}
                  </LoadingButton>
                )}

                {showDateError && !selectedDate && (
                  <p className="text-sm text-destructive text-center flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Please select a delivery date
                  </p>
                )}
                
                {showTermsError && !termsAccepted && selectedDate && (
                  <p className="text-sm text-destructive text-center flex items-center justify-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Please accept the terms to continue
                  </p>
                )}
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
