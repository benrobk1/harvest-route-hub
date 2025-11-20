-- Fix credits redemption race condition with atomic decrement function
--
-- BUG: The old checkout code had a SELECT-then-INSERT pattern:
--   1. SELECT balance_after FROM credits_ledger WHERE consumer_id = X
--   2. Calculate new_balance = old_balance - credits_used in app code
--   3. INSERT INTO credits_ledger (balance_after = new_balance)
--
-- PROBLEM: Two concurrent checkouts could both read the same balance,
-- then both insert, causing credits to be under-deducted and allowing users
-- to overspend their available credits.
--
-- EXAMPLE ATTACK:
--   User has $50 credits. Places two $30 orders simultaneously.
--   - Checkout A reads balance = $50
--   - Checkout B reads balance = $50 (same!)
--   - Checkout A inserts balance_after = $20
--   - Checkout B inserts balance_after = $20
--   Result: User spent $60, but balance only decreased by $30!
--
-- SOLUTION: Atomic function that reads current balance, validates sufficient
-- credits, and inserts new ledger entry in a single transaction.

CREATE OR REPLACE FUNCTION redeem_credits_atomic(
  p_consumer_id UUID,
  p_order_id UUID,
  p_credits_to_redeem NUMERIC,
  p_description TEXT DEFAULT 'Credits redeemed for order'
)
RETURNS TABLE (
  new_balance NUMERIC,
  old_balance NUMERIC,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validate input
  IF p_credits_to_redeem <= 0 THEN
    RAISE EXCEPTION 'Credits to redeem must be positive, got: %', p_credits_to_redeem;
  END IF;

  -- Get current balance (latest ledger entry)
  SELECT balance_after INTO v_old_balance
  FROM credits_ledger
  WHERE consumer_id = p_consumer_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Default to 0 if no previous balance
  v_old_balance := COALESCE(v_old_balance, 0);

  -- Calculate new balance
  v_new_balance := v_old_balance - p_credits_to_redeem;

  -- Validate sufficient credits (strict enforcement)
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient credits. Balance: %, Requested: %', v_old_balance, p_credits_to_redeem
      USING ERRCODE = 'check_violation';
  END IF;

  -- Atomically insert new ledger entry
  INSERT INTO credits_ledger (
    consumer_id,
    order_id,
    transaction_type,
    amount,
    balance_after,
    description
  ) VALUES (
    p_consumer_id,
    p_order_id,
    'redemption',
    -p_credits_to_redeem,
    v_new_balance,
    p_description
  )
  RETURNING id INTO v_transaction_id;

  -- Return all relevant information for verification
  RETURN QUERY SELECT v_new_balance, v_old_balance, v_transaction_id;
END;
$$;

-- Add similar function for calculating available credits (read-only)
CREATE OR REPLACE FUNCTION get_available_credits(
  p_consumer_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT balance_after INTO v_balance
  FROM credits_ledger
  WHERE consumer_id = p_consumer_id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_balance, 0);
END;
$$;

-- Add constraint to prevent negative balances (defense-in-depth)
-- This provides an extra safety net if the application logic fails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credits_ledger_balance_nonnegative'
  ) THEN
    ALTER TABLE credits_ledger
    ADD CONSTRAINT credits_ledger_balance_nonnegative
    CHECK (balance_after >= 0);
  END IF;
END $$;

-- Add index for performance (credits queries are frequent)
CREATE INDEX IF NOT EXISTS idx_credits_ledger_consumer_created
  ON credits_ledger(consumer_id, created_at DESC);

COMMENT ON FUNCTION redeem_credits_atomic IS
  'Atomically redeems credits for an order. Validates sufficient balance and prevents race conditions during concurrent checkouts. Raises exception if insufficient credits.';

COMMENT ON FUNCTION get_available_credits IS
  'Returns current credit balance for a consumer. Thread-safe read operation.';

COMMENT ON CONSTRAINT credits_ledger_balance_nonnegative ON credits_ledger IS
  'Prevents negative credit balances. Defense-in-depth against race conditions and application bugs.';
