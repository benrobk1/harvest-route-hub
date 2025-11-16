#!/bin/bash
set -e

echo "🚀 Deploying Race Condition Fixes"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check git status
echo -e "${BLUE}Step 1: Checking git status...${NC}"
git status --short
echo ""

# Step 2: Add all changes
echo -e "${BLUE}Step 2: Staging changes...${NC}"
git add \
  supabase/functions/claim-route/index.ts \
  supabase/functions/_shared/services/CheckoutService.ts \
  supabase/migrations/20251116000000_fix_inventory_race_condition.sql \
  supabase/functions/__tests__/claim-route-race-condition.test.ts \
  BUGFIX-RACE-CONDITIONS.md \
  test-race-condition-fixes.md

echo -e "${GREEN}✓ Files staged${NC}"
echo ""

# Step 3: Commit
echo -e "${BLUE}Step 3: Committing changes...${NC}"
git commit -m "Fix critical race conditions in batch claiming and inventory

🐛 Bug Fixes:
- Fixed batch claiming race condition using atomic UPDATE with WHERE conditions
- Fixed inventory overselling race condition using database-side atomic decrement
- Added CHECK constraint to prevent negative inventory at database level

📁 Files Modified:
- supabase/functions/claim-route/index.ts
- supabase/functions/_shared/services/CheckoutService.ts

📁 Files Created:
- supabase/migrations/20251116000000_fix_inventory_race_condition.sql
- supabase/functions/__tests__/claim-route-race-condition.test.ts
- BUGFIX-RACE-CONDITIONS.md (comprehensive documentation)
- test-race-condition-fixes.md (testing guide)

🎯 Impact:
- Prevents multiple drivers from claiming same batch
- Prevents overselling of products during concurrent checkouts
- Ensures data integrity with database-level constraints

🔍 Testing:
See test-race-condition-fixes.md for manual testing instructions

Closes issue: Race conditions in concurrent operations"

echo -e "${GREEN}✓ Changes committed${NC}"
echo ""

# Step 4: Show commit
echo -e "${BLUE}Step 4: Showing commit details...${NC}"
git log -1 --stat
echo ""

# Step 5: Push to remote
echo -e "${YELLOW}Step 5: Pushing to remote...${NC}"
read -p "Push to origin/codex/find-and-fix-important-bug-in-codebase? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin codex/find-and-fix-important-bug-in-codebase
    echo -e "${GREEN}✓ Pushed to remote${NC}"
else
    echo -e "${YELLOW}⚠ Skipped push (you can run: git push origin codex/find-and-fix-important-bug-in-codebase)${NC}"
fi
echo ""

# Step 6: Apply database migration
echo -e "${BLUE}Step 6: Apply database migration${NC}"
echo "You need to apply the SQL migration to your Supabase database:"
echo ""
echo -e "${YELLOW}Option 1: Supabase Dashboard${NC}"
echo "  1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql"
echo "  2. Copy SQL from: supabase/migrations/20251116000000_fix_inventory_race_condition.sql"
echo "  3. Paste and execute"
echo ""
echo -e "${YELLOW}Option 2: Supabase CLI (if installed)${NC}"
echo "  supabase db push"
echo ""

# Step 7: Next steps
echo -e "${GREEN}✅ Git operations complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Apply database migration (see Step 6 above)"
echo "2. Test the fixes (see test-race-condition-fixes.md)"
echo "3. Monitor logs for 'INSUFFICIENT_INVENTORY' errors (expected to increase)"
echo "4. Verify no negative inventory values in database"
echo ""
echo "📚 Documentation:"
echo "  - BUGFIX-RACE-CONDITIONS.md - Technical details"
echo "  - test-race-condition-fixes.md - Testing guide"
echo ""
echo "🎉 Race condition bugs are fixed!"
