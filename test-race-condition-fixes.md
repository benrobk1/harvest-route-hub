# Race Condition Fix Verification

## ✅ Completed Steps

1. **Fixed batch claiming race condition** in `claim-route/index.ts`
   - Changed from check-then-act to atomic UPDATE with WHERE conditions
   - Only one driver can successfully claim a batch

2. **Fixed inventory race condition** in `CheckoutService.ts`
   - Changed from SELECT-then-UPDATE to database RPC function
   - Created `decrement_product_quantity()` function for atomic decrements
   - Added CHECK constraint to prevent negative inventory

3. **Created database migration** `20251116000000_fix_inventory_race_condition.sql`
   - Defines atomic decrement function
   - Adds constraint for inventory validation

## 🧪 Testing Instructions

### Test 1: Batch Claiming (Manual)
```bash
# You'll need two terminal windows and two driver accounts

# Terminal 1 (Driver A)
curl -X POST https://your-project.supabase.co/functions/v1/claim-route \
  -H "Authorization: Bearer DRIVER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batch_id": "test-batch-id"}'

# Terminal 2 (Driver B) - run simultaneously
curl -X POST https://your-project.supabase.co/functions/v1/claim-route \
  -H "Authorization: Bearer DRIVER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"batch_id": "test-batch-id"}'

# Expected result:
# - One driver gets: {"success": true}
# - Other driver gets: {"error": "BATCH_UNAVAILABLE"} (409 status)
```

### Test 2: Inventory Race (Manual)
```bash
# Set up: Create a product with quantity = 5

# Checkout 1: Buy 3 units
curl -X POST https://your-project.supabase.co/functions/v1/checkout \
  -H "Authorization: Bearer CONSUMER_A_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cart_items": [{"product_id": "...", "quantity": 3}]}'

# Checkout 2: Buy 3 units (run simultaneously)
curl -X POST https://your-project.supabase.co/functions/v1/checkout \
  -H "Authorization: Bearer CONSUMER_B_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cart_items": [{"product_id": "...", "quantity": 3}]}'

# Expected result:
# - First checkout succeeds (inventory: 5 → 2)
# - Second checkout fails with "INSUFFICIENT_INVENTORY"
```

## 📋 Deployment Checklist

### Database Migration

**Option 1: Using Supabase Dashboard (Recommended)**
1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql
2. Copy the SQL from `supabase/migrations/20251116000000_fix_inventory_race_condition.sql`
3. Paste and run the SQL
4. Verify the function exists:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_name = 'decrement_product_quantity';
   ```

**Option 2: Using Supabase CLI**
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

### Code Deployment

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Fix critical race conditions in batch claiming and inventory updates"
   git push origin codex/find-and-fix-important-bug-in-codebase
   ```

2. **Deploy edge functions:**
   ```bash
   supabase functions deploy claim-route
   supabase functions deploy checkout
   ```
   Or push to your main branch and let CI/CD handle it.

### Verification

After deployment, monitor for these indicators:

1. **Logs showing atomic operations:**
   ```
   [REQUEST_ID] ✅ Atomically updated inventory for N products
   ```

2. **Expected errors (these are GOOD - they mean race conditions are being caught):**
   ```
   BATCH_UNAVAILABLE - Second driver couldn't claim
   INSUFFICIENT_INVENTORY - Product out of stock during concurrent checkout
   ```

3. **No longer see:**
   ```
   Negative inventory values in products table
   Multiple drivers assigned to same batch
   ```

## 🎯 Success Criteria

- ✅ Migration applied successfully
- ✅ `decrement_product_quantity` function exists in database
- ✅ CHECK constraint `products_available_quantity_nonnegative` exists
- ✅ Edge functions deployed with updated code
- ✅ No errors in production logs
- ✅ Concurrent operations properly serialized

## 🔍 Monitoring

Watch these metrics for the first 24 hours:

- Increase in `INSUFFICIENT_INVENTORY` errors (expected - races now caught)
- Decrease in customer complaints about overselling
- No negative inventory values in database
- No duplicate driver assignments to batches

## 📚 Documentation Updated

- ✅ `BUGFIX-RACE-CONDITIONS.md` - Full technical details
- ✅ Code comments explain atomic operations
- ✅ Test documentation in `__tests__/claim-route-race-condition.test.ts`
