-- Add critical database indexes for 50k+ user scalability
--
-- PROBLEM: At 50k users, several high-frequency queries are performing
-- sequential scans instead of index seeks, causing severe performance degradation.
--
-- Key bottlenecks identified:
-- 1. Shopping cart lookups by consumer_id (every cart access)
-- 2. Product filtering by approved+available_quantity (shop page loads)
-- 3. Order items by order_id (checkout, order display)
--
-- SOLUTION: Add targeted composite and single-column indexes to optimize
-- the most critical query patterns for enterprise-scale performance.
--
-- IMPORTANT: This migration uses CREATE INDEX CONCURRENTLY to avoid locking
-- the tables during index creation. CONCURRENTLY cannot be used inside a
-- transaction block. Ensure your migration tool executes this file outside
-- of a transaction (Supabase CLI does this automatically for migrations).

-- ============================================================================
-- INDEX 1: Shopping cart lookups by consumer_id
-- ============================================================================
-- QUERY PATTERN: SELECT * FROM shopping_carts WHERE consumer_id = $1
-- FREQUENCY: Every cart view/modification (~1000/min at scale)
-- CURRENT: Sequential scan (no index on referencing FK column)
-- IMPACT: O(n) scan of 50k rows per lookup

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopping_carts_consumer_id
ON public.shopping_carts(consumer_id);

COMMENT ON INDEX idx_shopping_carts_consumer_id IS
  'Optimizes cart lookups by consumer. Critical for cart operations at scale. PostgreSQL does not auto-index FK referencing columns.';

-- ============================================================================
-- INDEX 2: Product filtering for shop page
-- ============================================================================
-- QUERY PATTERN:
--   SELECT * FROM products
--   WHERE approved = true AND available_quantity > 0
--
-- FREQUENCY: Every shop page load (~500/min at scale)
-- CURRENT: Partial indexes exist separately but not optimized for combined filter
-- IMPACT: Cannot use index-only scan, requires table access

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_approved_available
ON public.products(approved, available_quantity)
WHERE approved = true AND available_quantity > 0;

COMMENT ON INDEX idx_products_approved_available IS
  'Partial index for active products in shop. Enables efficient index scans for the most common product query pattern.';

-- ============================================================================
-- INDEX 3: Order items by order_id (if missing)
-- ============================================================================
-- QUERY PATTERN: SELECT * FROM order_items WHERE order_id = $1
-- FREQUENCY: Every order display, checkout validation (~800/min at scale)
-- IMPACT: Critical for order details page and checkout flow

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
ON public.order_items(order_id);

COMMENT ON INDEX idx_order_items_order_id IS
  'Optimizes order items lookup. Essential for order display and checkout performance.';

-- ============================================================================
-- INDEX 4: Delivery batches by date and driver (optimization)
-- ============================================================================
-- QUERY PATTERN:
--   SELECT * FROM delivery_batches
--   WHERE delivery_date = $1 AND driver_id IS NULL
--   (for available routes to claim)
--
-- NOTE: idx_delivery_batches_date_status already exists,
-- but driver_id is also frequently filtered. Add composite index for better selectivity.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_batches_date_driver
ON public.delivery_batches(delivery_date, driver_id)
WHERE driver_id IS NULL;

COMMENT ON INDEX idx_delivery_batches_date_driver IS
  'Partial index for unclaimed delivery batches. Optimizes route claiming by drivers.';

-- ============================================================================
-- Performance verification queries (for testing)
-- ============================================================================
-- After applying this migration, verify index usage with:
--
-- EXPLAIN ANALYZE
-- SELECT * FROM shopping_carts WHERE consumer_id = '<uuid>';
-- → Should show "Index Scan using idx_shopping_carts_consumer_id"
--
-- EXPLAIN ANALYZE
-- SELECT * FROM products WHERE approved = true AND available_quantity > 0;
-- → Should show "Index Scan using idx_products_approved_available"
--
-- EXPLAIN ANALYZE
-- SELECT * FROM delivery_batches WHERE delivery_date = '2025-11-22' AND driver_id IS NULL;
-- → Should show "Index Scan using idx_delivery_batches_date_driver"
