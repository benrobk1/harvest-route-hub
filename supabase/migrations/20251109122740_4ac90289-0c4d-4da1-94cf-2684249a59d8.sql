-- Add pre-approved feedback tags and reviewer type to delivery_ratings
ALTER TABLE delivery_ratings 
ADD COLUMN IF NOT EXISTS feedback_tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS reviewer_type TEXT CHECK (reviewer_type IN ('consumer', 'lead_farmer')) DEFAULT 'consumer';

-- Update existing delivery_ratings RLS policies to allow lead farmers to rate drivers
DROP POLICY IF EXISTS "Lead farmers can create ratings for drivers" ON delivery_ratings;
CREATE POLICY "Lead farmers can create ratings for drivers"
ON delivery_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  reviewer_type = 'lead_farmer' AND
  EXISTS (
    SELECT 1 FROM delivery_batches db
    WHERE db.driver_id = delivery_ratings.driver_id
      AND db.lead_farmer_id = auth.uid()
      AND db.id IN (
        SELECT delivery_batch_id FROM orders WHERE id = delivery_ratings.order_id
      )
  )
);

DROP POLICY IF EXISTS "Lead farmers can view ratings for their drivers" ON delivery_ratings;
CREATE POLICY "Lead farmers can view ratings for their drivers"
ON delivery_ratings
FOR SELECT
TO authenticated
USING (
  reviewer_type = 'lead_farmer' AND
  EXISTS (
    SELECT 1 FROM delivery_batches db
    WHERE db.driver_id = delivery_ratings.driver_id
      AND db.lead_farmer_id = auth.uid()
  )
);

-- Create farm_ratings table
CREATE TABLE IF NOT EXISTS farm_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_profile_id UUID REFERENCES farm_profiles(id) ON DELETE CASCADE NOT NULL,
  consumer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback TEXT,
  feedback_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(farm_profile_id, consumer_id, order_id)
);

-- Enable RLS on farm_ratings
ALTER TABLE farm_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for farm_ratings
CREATE POLICY "Consumers can create ratings for farms they ordered from"
ON farm_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = consumer_id AND
  EXISTS (
    SELECT 1 FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id
    WHERE o.id = farm_ratings.order_id
      AND o.consumer_id = auth.uid()
      AND p.farm_profile_id = farm_ratings.farm_profile_id
      AND o.status = 'delivered'
  )
);

CREATE POLICY "Consumers can view their own farm ratings"
ON farm_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = consumer_id);

CREATE POLICY "Farmers can view ratings for their farm"
ON farm_ratings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM farm_profiles fp
    WHERE fp.id = farm_ratings.farm_profile_id
      AND fp.farmer_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all farm ratings"
ON farm_ratings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create order_item_ratings table
CREATE TABLE IF NOT EXISTS order_item_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE NOT NULL,
  consumer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  farm_profile_id UUID REFERENCES farm_profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  feedback TEXT,
  feedback_tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_item_id, consumer_id)
);

-- Enable RLS on order_item_ratings
ALTER TABLE order_item_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_item_ratings
CREATE POLICY "Consumers can create ratings for items from their orders"
ON order_item_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = consumer_id AND
  EXISTS (
    SELECT 1 FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_ratings.order_item_id
      AND o.consumer_id = auth.uid()
      AND o.status = 'delivered'
  )
);

CREATE POLICY "Consumers can view their own item ratings"
ON order_item_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = consumer_id);

CREATE POLICY "Farmers can view ratings for their products"
ON order_item_ratings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM farm_profiles fp
    WHERE fp.id = order_item_ratings.farm_profile_id
      AND fp.farmer_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all item ratings"
ON order_item_ratings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create helper functions for aggregate ratings
CREATE OR REPLACE FUNCTION get_farm_rating(p_farm_profile_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*), ROUND(AVG(rating)::NUMERIC, 1)
  INTO v_count, v_avg_rating
  FROM farm_ratings
  WHERE farm_profile_id = p_farm_profile_id;
  
  -- Only return rating if threshold is met
  IF v_count >= 25 THEN
    RETURN COALESCE(v_avg_rating, 0);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION get_product_rating(p_product_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*), ROUND(AVG(rating)::NUMERIC, 1)
  INTO v_count, v_avg_rating
  FROM order_item_ratings
  WHERE product_id = p_product_id;
  
  -- Only return rating if threshold is met
  IF v_count >= 25 THEN
    RETURN COALESCE(v_avg_rating, 0);
  ELSE
    RETURN NULL;
  END IF;
END;
$$;