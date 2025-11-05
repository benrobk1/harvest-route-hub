import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { LoadingButton } from '@/components/LoadingButton';
import { useErrorHandler } from '@/lib/errors/useErrorHandler';
import { createPaymentError } from '@/features/orders/errors';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

interface PaymentFormProps {
  onSuccess: () => void;
  amount: number;
}

export const PaymentForm = ({ onSuccess, amount }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { handlePaymentError } = useErrorHandler();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentProgress, setPaymentProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentProgress(30);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setPaymentProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/consumer/orders`,
      },
    });

    clearInterval(progressInterval);
    setPaymentProgress(100);

    if (error) {
      handlePaymentError(createPaymentError(error.message || 'Payment failed'));
      setIsProcessing(false);
      setPaymentProgress(0);
    } else {
      toast({
        title: '✅ Payment Confirmed',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Processing your order...</span>
          </div>
        ),
        duration: 3000,
      });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Processing payment...
            </span>
            <span>{paymentProgress}%</span>
          </div>
          <Progress value={paymentProgress} className="h-2" />
        </div>
      )}
      <LoadingButton
        type="submit"
        disabled={!stripe}
        isLoading={isProcessing}
        loadingText="Processing payment..."
        className="w-full"
      >
        Pay ${amount.toFixed(2)}
      </LoadingButton>
    </form>
  );
};
