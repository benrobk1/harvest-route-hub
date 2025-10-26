-- Shopping cart tables for persisted cart
CREATE TABLE public.shopping_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(consumer_id)
);

CREATE TABLE public.cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cart_id, product_id)
);

-- Credits ledger for loyalty/wallet system
CREATE TABLE public.credits_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'refund')),
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL CHECK (balance_after >= 0),
  description TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Transaction fees for complete fee tracking
CREATE TABLE public.transaction_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('platform', 'farmer_commission', 'delivery', 'tax', 'payment_processing')),
  amount NUMERIC NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inventory reservations for soft holds during checkout
CREATE TABLE public.inventory_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Batch stops for delivery routing
CREATE TABLE public.batch_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_batch_id UUID NOT NULL REFERENCES public.delivery_batches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Proof of delivery
CREATE TABLE public.delivery_proofs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_stop_id UUID NOT NULL REFERENCES public.batch_stops(id) ON DELETE CASCADE,
  photo_url TEXT,
  recipient_name TEXT,
  signature_url TEXT,
  notes TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Market configuration for ZIP schedules and fees
CREATE TABLE public.market_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code TEXT NOT NULL,
  delivery_days TEXT[] NOT NULL,
  delivery_fee NUMERIC NOT NULL CHECK (delivery_fee >= 0),
  minimum_order NUMERIC NOT NULL DEFAULT 25 CHECK (minimum_order >= 0),
  cutoff_time TIME NOT NULL DEFAULT '00:00:00',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(zip_code)
);

-- Add indexes for performance
CREATE INDEX idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX idx_credits_ledger_consumer_id ON public.credits_ledger(consumer_id);
CREATE INDEX idx_credits_ledger_order_id ON public.credits_ledger(order_id);
CREATE INDEX idx_transaction_fees_order_id ON public.transaction_fees(order_id);
CREATE INDEX idx_inventory_reservations_product_id ON public.inventory_reservations(product_id);
CREATE INDEX idx_inventory_reservations_expires_at ON public.inventory_reservations(expires_at) WHERE status = 'active';
CREATE INDEX idx_batch_stops_batch_id ON public.batch_stops(delivery_batch_id);
CREATE INDEX idx_batch_stops_order_id ON public.batch_stops(order_id);
CREATE INDEX idx_orders_consumer_id ON public.orders(consumer_id);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_products_farm_profile_id ON public.products(farm_profile_id);

-- Add partial index for active products
CREATE INDEX idx_products_active ON public.products(id) WHERE available_quantity > 0;

-- Enable RLS on new tables
ALTER TABLE public.shopping_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shopping_carts
CREATE POLICY "Users can view own cart"
  ON public.shopping_carts FOR SELECT
  USING (auth.uid() = consumer_id);

CREATE POLICY "Users can create own cart"
  ON public.shopping_carts FOR INSERT
  WITH CHECK (auth.uid() = consumer_id);

CREATE POLICY "Users can update own cart"
  ON public.shopping_carts FOR UPDATE
  USING (auth.uid() = consumer_id);

-- RLS Policies for cart_items
CREATE POLICY "Users can view own cart items"
  ON public.cart_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shopping_carts
    WHERE shopping_carts.id = cart_items.cart_id
    AND shopping_carts.consumer_id = auth.uid()
  ));

CREATE POLICY "Users can manage own cart items"
  ON public.cart_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.shopping_carts
    WHERE shopping_carts.id = cart_items.cart_id
    AND shopping_carts.consumer_id = auth.uid()
  ));

-- RLS Policies for credits_ledger
CREATE POLICY "Users can view own credits"
  ON public.credits_ledger FOR SELECT
  USING (auth.uid() = consumer_id);

CREATE POLICY "Admins can view all credits"
  ON public.credits_ledger FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for transaction_fees
CREATE POLICY "Admins can view all fees"
  ON public.transaction_fees FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Farmers can view fees for their orders"
  ON public.transaction_fees FOR SELECT
  USING (
    recipient_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.products p ON p.id = oi.product_id
      JOIN public.farm_profiles fp ON fp.id = p.farm_profile_id
      WHERE o.id = transaction_fees.order_id
      AND fp.farmer_id = auth.uid()
    )
  );

-- RLS Policies for inventory_reservations
CREATE POLICY "Users can view own reservations"
  ON public.inventory_reservations FOR SELECT
  USING (auth.uid() = consumer_id);

-- RLS Policies for batch_stops
CREATE POLICY "Drivers can view assigned batch stops"
  ON public.batch_stops FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.delivery_batches
    WHERE delivery_batches.id = batch_stops.delivery_batch_id
    AND delivery_batches.driver_id = auth.uid()
  ));

CREATE POLICY "Admins can view all batch stops"
  ON public.batch_stops FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Drivers can update assigned batch stops"
  ON public.batch_stops FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.delivery_batches
    WHERE delivery_batches.id = batch_stops.delivery_batch_id
    AND delivery_batches.driver_id = auth.uid()
  ));

-- RLS Policies for delivery_proofs
CREATE POLICY "Drivers can create delivery proofs"
  ON public.delivery_proofs FOR INSERT
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can view own delivery proofs"
  ON public.delivery_proofs FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all delivery proofs"
  ON public.delivery_proofs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for market_configs
CREATE POLICY "Anyone can view active market configs"
  ON public.market_configs FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage market configs"
  ON public.market_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_shopping_carts_updated_at
  BEFORE UPDATE ON public.shopping_carts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_market_configs_updated_at
  BEFORE UPDATE ON public.market_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();