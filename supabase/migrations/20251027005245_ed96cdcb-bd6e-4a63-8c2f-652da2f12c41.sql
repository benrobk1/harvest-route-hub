-- Add Stripe Connect account info to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean DEFAULT false;

-- Create table for storing payment intents
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text UNIQUE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  consumer_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL,
  payment_method text,
  client_secret text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table for tracking payouts
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('farmer', 'driver', 'platform')),
  amount numeric(10,2) NOT NULL,
  stripe_transfer_id text,
  stripe_connect_account_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS on new tables
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for payment_intents
CREATE POLICY "Users can view own payment intents"
  ON public.payment_intents FOR SELECT
  USING (auth.uid() = consumer_id);

CREATE POLICY "Admins can view all payment intents"
  ON public.payment_intents FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for payouts
CREATE POLICY "Users can view own payouts"
  ON public.payouts FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Admins can view all payouts"
  ON public.payouts FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on payment_intents
CREATE TRIGGER update_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payment_intents_stripe_id ON public.payment_intents(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order_id ON public.payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON public.payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient_id ON public.payouts(recipient_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account ON public.profiles(stripe_connect_account_id);