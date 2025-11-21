-- Optimize rate limiting for 50k+ users
-- Reduces 3 DB operations (SELECT + INSERT + DELETE) to 1 atomic operation
-- Critical for scalability

-- Add index on created_at for faster cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at);

-- Add composite index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created ON rate_limits(key, created_at DESC);

-- Optimized rate limit check function
-- Performs check, insert, and cleanup in a single atomic operation
CREATE OR REPLACE FUNCTION check_and_record_rate_limit(
  p_key TEXT,
  p_window_start TIMESTAMPTZ,
  p_max_requests INTEGER
)
RETURNS TABLE(allowed BOOLEAN, request_count INTEGER, oldest_request_time TIMESTAMPTZ) AS $$
DECLARE
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
BEGIN
  -- Clean up old entries for this key (done first to keep table lean)
  DELETE FROM rate_limits
  WHERE key = p_key AND created_at < p_window_start;

  -- Count recent requests within the window
  SELECT COUNT(*), MIN(created_at)
  INTO v_count, v_oldest
  FROM rate_limits
  WHERE key = p_key AND created_at >= p_window_start;

  -- If under limit, insert new request
  IF v_count < p_max_requests THEN
    INSERT INTO rate_limits (key, created_at)
    VALUES (p_key, NOW());

    RETURN QUERY SELECT TRUE, v_count + 1, v_oldest;
  ELSE
    -- Over limit, don't insert
    RETURN QUERY SELECT FALSE, v_count, v_oldest;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION check_and_record_rate_limit IS
  'Atomic rate limit check that combines SELECT, INSERT, and DELETE operations.
   Returns: allowed (boolean), current request count, oldest request timestamp.
   Critical optimization for high-traffic scenarios with 50k+ users.';

-- Atomic product quantity increment function
-- Eliminates SELECT+UPDATE pattern, prevents race conditions
-- Used for inventory restoration during order cancellation
CREATE OR REPLACE FUNCTION increment_product_quantity(
  p_product_id UUID,
  p_quantity_delta INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET available_quantity = available_quantity + p_quantity_delta
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_product_quantity IS
  'Atomically increments product quantity. Used for inventory restoration.
   Eliminates N+1 query pattern (SELECT then UPDATE) in order cancellation.
   Critical for 50k+ order cancellations.';

-- Add critical compound indexes for scalability with 50k+ users
-- These indexes optimize the most frequent queries in the application

-- Index for batch generation queries (delivery_date + status)
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date_status
  ON orders(delivery_date, status)
  WHERE status IN ('pending', 'confirmed');

-- Index for user order history queries
CREATE INDEX IF NOT EXISTS idx_orders_consumer_created
  ON orders(consumer_id, created_at DESC);

-- Index for daily batch queries
CREATE INDEX IF NOT EXISTS idx_delivery_batches_date
  ON delivery_batches(delivery_date DESC);

-- Index for batch assignment queries
CREATE INDEX IF NOT EXISTS idx_orders_batch_id
  ON orders(batch_id)
  WHERE batch_id IS NOT NULL;

COMMENT ON INDEX idx_orders_delivery_date_status IS
  'Optimizes batch generation queries. Critical for 50k+ daily orders.';
COMMENT ON INDEX idx_orders_consumer_created IS
  'Optimizes user order history queries. Critical for 50k+ users.';
COMMENT ON INDEX idx_delivery_batches_date IS
  'Optimizes daily batch lookup queries. Critical for 50k+ daily batches.';
COMMENT ON INDEX idx_orders_batch_id IS
  'Optimizes batch assignment lookups. Critical for 50k+ orders.';
