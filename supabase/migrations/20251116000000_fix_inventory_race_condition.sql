-- Fix inventory race condition with atomic decrement function
-- 
-- BUG: The old checkout code had a SELECT-then-UPDATE pattern:
--   1. SELECT available_quantity FROM products WHERE id = X
--   2. UPDATE products SET available_quantity = (quantity - N) WHERE id = X
-- 
-- PROBLEM: Two concurrent checkouts could both read the same quantity,
-- then both update, causing inventory to be incorrect and potentially negative.
--
-- SOLUTION: Atomic UPDATE with PostgreSQL's built-in arithmetic
-- that executes as a single operation, preventing race conditions.

CREATE OR REPLACE FUNCTION decrement_product_quantity(
  product_id UUID,
  decrement_by INTEGER
)
RETURNS TABLE (
  new_quantity INTEGER,
  old_quantity INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_quantity INTEGER;
  v_new_quantity INTEGER;
BEGIN
  -- Atomic update: Read and write in single operation
  UPDATE products
  SET available_quantity = available_quantity - decrement_by
  WHERE id = product_id
  RETURNING 
    available_quantity INTO v_new_quantity,
    available_quantity + decrement_by INTO v_old_quantity;
  
  -- Return both old and new quantities for verification
  RETURN QUERY SELECT v_new_quantity, v_old_quantity;
END;
$$;

-- Add check constraint to prevent negative inventory at database level
-- This provides defense-in-depth: even if application logic fails,
-- database rejects every update that would make inventory negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_available_quantity_nonnegative'
  ) THEN
    ALTER TABLE products 
    ADD CONSTRAINT products_available_quantity_nonnegative 
    CHECK (available_quantity >= 0);
  END IF;
END $$;

COMMENT ON FUNCTION decrement_product_quantity IS 
  'Atomically decrements product quantity to prevent race conditions during concurrent checkouts. Returns old and new quantities for verification.';

COMMENT ON CONSTRAINT products_available_quantity_nonnegative ON products IS
  'Prevents overselling by rejecting each update that would make inventory negative. Defense-in-depth against race conditions.';
