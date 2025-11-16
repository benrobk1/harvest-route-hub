-- Add tax_id_last4 column to profiles table
-- This stores the last 4 digits of the tax ID in plaintext for display on 1099 forms
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tax_id_last4 TEXT CHECK (tax_id_last4 ~ '^[0-9]{4}$');

COMMENT ON COLUMN profiles.tax_id_last4 IS 'Last 4 digits of tax ID for display on 1099 forms';
