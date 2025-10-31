-- Add last_reviewed_at to products table for weekly inventory tracking
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_reviewed_at timestamp with time zone DEFAULT now();

-- Update existing products to set initial review date
UPDATE products 
SET last_reviewed_at = updated_at 
WHERE last_reviewed_at IS NULL;