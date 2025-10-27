-- Add referral_code to profiles
ALTER TABLE public.profiles 
ADD COLUMN referral_code TEXT UNIQUE;

-- Generate unique referral codes for existing users
UPDATE public.profiles 
SET referral_code = 'BH' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  credit_amount NUMERIC NOT NULL DEFAULT 25.00,
  referee_first_order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  credited_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referrer_id, referee_id)
);

-- Enable RLS on referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view referrals they made
CREATE POLICY "Users can view own referrals"
ON public.referrals
FOR SELECT
USING (auth.uid() = referrer_id);

-- Users can view referrals they received
CREATE POLICY "Users can view referrals received"
ON public.referrals
FOR SELECT
USING (auth.uid() = referee_id);

-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals"
ON public.referrals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes for better performance
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referee_id ON public.referrals(referee_id);
CREATE INDEX idx_referrals_status ON public.referrals(status);

-- Add tip_amount to orders table
ALTER TABLE public.orders 
ADD COLUMN tip_amount NUMERIC NOT NULL DEFAULT 0;

-- Function to generate referral code for new users
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character code with BH prefix
    new_code := 'BH' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Update the handle_new_user trigger to generate referral codes
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    generate_referral_code()
  );
  RETURN NEW;
END;
$$;