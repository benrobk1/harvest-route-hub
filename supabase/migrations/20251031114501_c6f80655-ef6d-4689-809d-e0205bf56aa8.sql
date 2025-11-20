-- ============================================================================
-- P0 - CRITICAL SECURITY FIXES
-- ============================================================================

-- 1. TIME-BASED ADDRESS VISIBILITY FOR BATCH STOPS
-- Add address visibility timestamp to control when drivers can see addresses
ALTER TABLE batch_stops 
  ADD COLUMN IF NOT EXISTS address_visible_at timestamptz;

-- Function to update visibility as driver progresses through route
CREATE OR REPLACE FUNCTION update_address_visibility()
RETURNS TRIGGER AS $$
BEGIN
  -- When a stop is marked as delivered or in_progress
  IF NEW.status IN ('delivered', 'in_progress') AND OLD.status = 'pending' THEN
    -- Make next 3 stops visible
    UPDATE batch_stops
    SET address_visible_at = now()
    WHERE delivery_batch_id = NEW.delivery_batch_id
      AND sequence_number > NEW.sequence_number
      AND sequence_number <= NEW.sequence_number + 3
      AND address_visible_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to automatically update address visibility
DROP TRIGGER IF EXISTS on_stop_status_change ON batch_stops;
CREATE TRIGGER on_stop_status_change
  AFTER UPDATE OF status ON batch_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_address_visibility();

-- Initialize visibility for first 3 stops in existing active batches
UPDATE batch_stops bs
SET address_visible_at = now()
WHERE sequence_number <= 3
  AND status = 'pending'
  AND address_visible_at IS NULL
  AND EXISTS (
    SELECT 1 FROM delivery_batches db
    WHERE db.id = bs.delivery_batch_id
    AND db.status = 'assigned'
  );

-- 2. FARMER-SCOPED RLS FOR ORDER ITEMS
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Users can view order items" ON order_items;

-- Ensure consumer-scoped policy exists
DROP POLICY IF EXISTS "Consumers can view own order items" ON order_items;
CREATE POLICY "Consumers can view own order items"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_items.order_id
    AND o.consumer_id = auth.uid()
  )
);

-- Create farmer-scoped policy (NEW - critical fix)
DROP POLICY IF EXISTS "Farmers can view order items for their products" ON order_items;
CREATE POLICY "Farmers can view order items for their products"
ON order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM products p
    JOIN farm_profiles fp ON fp.id = p.farm_profile_id
    WHERE p.id = order_items.product_id
    AND fp.farmer_id = auth.uid()
  )
);

-- Admin policy for order items
DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items"
ON order_items FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin')
);

-- ============================================================================
-- P1 - HIGH PRIORITY SECURITY
-- ============================================================================

-- 3. CREATE get_consumer_address() SECURITY DEFINER FUNCTION
-- This function restricts address access to authorized users only
CREATE OR REPLACE FUNCTION get_consumer_address(
  _consumer_id uuid,
  _delivery_batch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  full_name text,
  street_address text,
  city text,
  state text,
  zip_code text,
  phone text
) 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _calling_user_id uuid := auth.uid();
BEGIN
  -- Allow consumers to see their own address
  IF _calling_user_id = _consumer_id THEN
    RETURN QUERY
    SELECT p.full_name, p.street_address, p.city, p.state, p.zip_code, p.phone
    FROM profiles p
    WHERE p.id = _consumer_id;
    RETURN;
  END IF;

  -- Allow admins to see every address
  IF has_role(_calling_user_id, 'admin') THEN
    RETURN QUERY
    SELECT p.full_name, p.street_address, p.city, p.state, p.zip_code, p.phone
    FROM profiles p
    WHERE p.id = _consumer_id;
    RETURN;
  END IF;

  -- Allow driver to see address ONLY if:
  -- 1. The delivery batch is assigned to them
  -- 2. The stop is currently visible (address_visible_at is set)
  -- 3. The consumer has an order in that batch
  IF _delivery_batch_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM delivery_batches db
      JOIN batch_stops bs ON bs.delivery_batch_id = db.id
      JOIN orders o ON o.id = bs.order_id
      WHERE db.id = _delivery_batch_id
        AND db.driver_id = _calling_user_id
        AND o.consumer_id = _consumer_id
        AND bs.address_visible_at IS NOT NULL
    ) THEN
      RETURN QUERY
      SELECT p.full_name, p.street_address, p.city, p.state, p.zip_code, p.phone
      FROM profiles p
      WHERE p.id = _consumer_id;
      RETURN;
    END IF;
  END IF;

  -- If none of the above, return NULL (no access)
  RETURN;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION get_consumer_address(uuid, uuid) TO authenticated;

-- 4. CREATE driver_batch_stops VIEW WITH CONDITIONAL ADDRESS MASKING
-- This view automatically masks addresses that aren't visible yet
CREATE OR REPLACE VIEW driver_batch_stops AS
SELECT 
  bs.id,
  bs.delivery_batch_id,
  bs.order_id,
  bs.sequence_number,
  bs.latitude,
  bs.longitude,
  bs.estimated_arrival,
  bs.actual_arrival,
  bs.created_at,
  bs.geojson,
  bs.status,
  bs.notes,
  -- Conditionally expose address fields based on visibility
  CASE 
    WHEN bs.address_visible_at IS NOT NULL THEN bs.address
    ELSE 'Address available when delivery is near'
  END as address,
  CASE 
    WHEN bs.address_visible_at IS NOT NULL THEN bs.street_address
    ELSE NULL
  END as street_address,
  CASE 
    WHEN bs.address_visible_at IS NOT NULL THEN bs.city
    ELSE NULL
  END as city,
  CASE 
    WHEN bs.address_visible_at IS NOT NULL THEN bs.state
    ELSE NULL
  END as state,
  bs.zip_code, -- ZIP code is okay to show for general routing
  bs.address_visible_at
FROM batch_stops bs;

-- Grant access to the view
GRANT SELECT ON driver_batch_stops TO authenticated;

-- ============================================================================
-- P2 - ADMIN AUDIT LOG & RATE LIMITING
-- ============================================================================

-- 5. CREATE ADMIN AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) NOT NULL,
  action_type text NOT NULL, -- 'user_approved', 'role_granted', 'dispute_resolved', etc.
  target_user_id uuid REFERENCES auth.users(id),
  target_resource_type text, -- 'user', 'order', 'dispute', 'payout', etc.
  target_resource_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON admin_audit_log;
CREATE POLICY "Admins can view audit logs"
ON admin_audit_log FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert audit logs
DROP POLICY IF EXISTS "Admins can insert audit logs" ON admin_audit_log;
CREATE POLICY "Admins can insert audit logs"
ON admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- Create indexes for common audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target_user ON admin_audit_log(target_user_id);

-- Helper function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  _action_type text,
  _target_user_id uuid DEFAULT NULL,
  _target_resource_type text DEFAULT NULL,
  _target_resource_id uuid DEFAULT NULL,
  _old_value jsonb DEFAULT NULL,
  _new_value jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO admin_audit_log (
    admin_id,
    action_type,
    target_user_id,
    target_resource_type,
    target_resource_id,
    old_value,
    new_value
  ) VALUES (
    auth.uid(),
    _action_type,
    _target_user_id,
    _target_resource_type,
    _target_resource_id,
    _old_value,
    _new_value
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION log_admin_action TO authenticated;

-- 6. CREATE RATE LIMITING TABLE
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast rate limit lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created 
  ON rate_limits(key, created_at DESC);

-- Auto-cleanup function for old rate limit entries
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits
  WHERE created_at < now() - interval '1 hour';
$$;