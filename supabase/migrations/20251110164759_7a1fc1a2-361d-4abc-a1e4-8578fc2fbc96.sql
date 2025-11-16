-- Create enums for issue tracking
CREATE TYPE issue_category AS ENUM (
  'delivery_delay',
  'vehicle_problem',
  'customer_unavailable', 
  'wrong_address',
  'damaged_product',
  'missing_items',
  'collection_point_issue',
  'weather_condition',
  'other'
);

CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE issue_status AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved', 'dismissed');

-- Create delivery_issues table
CREATE TABLE delivery_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reporter information
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_type TEXT NOT NULL CHECK (reporter_type IN ('driver', 'farmer', 'lead_farmer')),
  
  -- Related entities
  delivery_batch_id UUID REFERENCES delivery_batches(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  stop_id UUID REFERENCES batch_stops(id) ON DELETE SET NULL,
  
  -- Issue details
  category issue_category NOT NULL,
  severity issue_severity NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL CHECK (length(title) >= 5 AND length(title) <= 200),
  description TEXT NOT NULL CHECK (length(description) >= 10 AND length(description) <= 2000),
  
  -- Location data
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  
  -- Media evidence
  photo_urls TEXT[],
  
  -- Resolution tracking
  status issue_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_delivery_issues_reporter ON delivery_issues(reporter_id);
CREATE INDEX idx_delivery_issues_status ON delivery_issues(status);
CREATE INDEX idx_delivery_issues_batch ON delivery_issues(delivery_batch_id);
CREATE INDEX idx_delivery_issues_created ON delivery_issues(created_at DESC);
CREATE INDEX idx_delivery_issues_severity ON delivery_issues(severity);

-- Updated at trigger
CREATE TRIGGER update_delivery_issues_updated_at
  BEFORE UPDATE ON delivery_issues
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Enable RLS
ALTER TABLE delivery_issues ENABLE ROW LEVEL SECURITY;

-- Drivers/farmers can insert their own issues
CREATE POLICY "Users can report issues" ON delivery_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id AND
    (has_role(auth.uid(), 'driver'::app_role) OR 
     has_role(auth.uid(), 'farmer'::app_role) OR 
     has_role(auth.uid(), 'lead_farmer'::app_role))
  );

-- Users can view their own issues
CREATE POLICY "Users can view own issues" ON delivery_issues
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

-- Admins can view all issues
CREATE POLICY "Admins can view all issues" ON delivery_issues
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all issues
CREATE POLICY "Admins can update issues" ON delivery_issues
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for admin dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_issues;