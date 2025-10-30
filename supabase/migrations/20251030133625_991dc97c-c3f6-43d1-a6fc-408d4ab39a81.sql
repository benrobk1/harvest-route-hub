-- Create delivery scan logs table for tracking box loading and delivery
CREATE TABLE delivery_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES delivery_batches(id) ON DELETE CASCADE,
  stop_id UUID REFERENCES batch_stops(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  box_code TEXT NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('loaded', 'delivered')),
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE delivery_scan_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_scan_logs
CREATE POLICY "Drivers can insert own scan logs"
ON delivery_scan_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can view own scan logs"
ON delivery_scan_logs FOR SELECT
TO authenticated
USING (auth.uid() = driver_id);

CREATE POLICY "Admins can view all scan logs"
ON delivery_scan_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add structured address fields to profiles table
ALTER TABLE profiles 
  ADD COLUMN street_address TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state TEXT,
  ADD COLUMN country TEXT DEFAULT 'USA';

-- Add structured address fields to batch_stops table
ALTER TABLE batch_stops
  ADD COLUMN street_address TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state TEXT,
  ADD COLUMN zip_code TEXT;

-- Create index for faster box code lookups
CREATE INDEX idx_delivery_scan_logs_box_code ON delivery_scan_logs(box_code);
CREATE INDEX idx_delivery_scan_logs_batch_id ON delivery_scan_logs(batch_id);
CREATE INDEX idx_delivery_scan_logs_driver_id ON delivery_scan_logs(driver_id);