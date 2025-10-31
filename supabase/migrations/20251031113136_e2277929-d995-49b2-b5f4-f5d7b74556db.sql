-- Phase 2 & 3: Add columns for trust signals and push notifications

-- Add harvest_date for "picked on" tags
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS harvest_date date;

-- Add push subscription for notifications
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS push_subscription jsonb;

-- Add geojson for route density visualization
ALTER TABLE batch_stops 
  ADD COLUMN IF NOT EXISTS geojson jsonb;

-- Add indexes for KPI query performance
CREATE INDEX IF NOT EXISTS idx_orders_status_created 
  ON orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batch_stops_status_created 
  ON batch_stops(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payouts_recipient_type_created 
  ON payouts(recipient_type, created_at DESC);

-- Add index for consumer orders (household queries)
CREATE INDEX IF NOT EXISTS idx_orders_consumer_status 
  ON orders(consumer_id, status, created_at DESC);