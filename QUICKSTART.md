# Quick Start for Developers

> **Documentation Version**: November 2025  
> **Project Status**: Production-ready, active development  
> **If anything seems outdated**: Check Git history or ask maintainers

Get the Blue Harvests marketplace running locally in 5 minutes.

## 🚀 5-Minute Setup

```bash
# 1. Clone and install dependencies
git clone <your-repo-url>
cd blue-harvests
npm install

# 2. Environment is pre-configured (Lovable Cloud)
# No .env setup needed - already connected to Supabase backend

# 3. Start the development server
npm run dev

# 4. Open your browser
# Visit http://localhost:5173
```

That's it! The app is now running locally.

## 👤 Test Accounts

Use these accounts to explore different user roles:

### Consumer Account
- **Email:** test-consumer@example.com
- **Password:** password123
- **Access:** Shopping, cart, checkout, order tracking

### Farmer Account
- **Email:** test-farmer@example.com
- **Password:** password123
- **Access:** Product management, inventory, financials, payouts

### Driver Account
- **Email:** test-driver@example.com
- **Password:** password123
- **Access:** Available routes, deliveries, earnings, ratings

### Admin Account
- **Email:** test-admin@example.com
- **Password:** password123
- **Access:** User management, market config, analytics, approvals

> **Note:** If test accounts don't exist yet, you'll need to create them via the signup flows and assign roles in the backend.

## 🔧 Key Commands

### Development
```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build
npm run preview          # Preview production build
```

### Testing
```bash
npm run test             # Run unit tests (Vitest)
npm run test:ui          # Open Vitest UI
npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # Playwright UI mode
```

### Code Quality
```bash
npm run type-check       # TypeScript validation
npm run lint             # ESLint check
```

### Supabase Functions (if needed)
```bash
# Deploy a specific edge function
supabase functions deploy <function-name>

# View function logs
supabase functions logs <function-name>

# Test function locally
supabase functions serve
```

## 🎯 First Feature to Explore

Start with the **checkout flow** - it demonstrates the full stack:

### 1. Consumer Experience (Frontend)
```
📁 Start here:
src/pages/consumer/Shop.tsx           → Product browsing
src/features/cart/components/CartDrawer.tsx  → Shopping cart
src/pages/consumer/Checkout.tsx       → Checkout form
src/components/checkout/PaymentForm.tsx → Stripe payment
```

**Try it:**
1. Sign in as consumer (test-consumer@example.com)
2. Browse products on Shop page
3. Add items to cart (click quantity selectors)
4. Open cart drawer (cart icon in header)
5. Click "Proceed to Checkout"
6. Enter delivery address
7. Complete payment (use Stripe test card: `4242 4242 4242 4242`)

### 2. Backend Logic (Edge Functions)
```
📁 Then explore:
supabase/functions/checkout/index.ts              → Entry point
supabase/functions/_shared/services/CheckoutService.ts → Business logic
supabase/functions/_shared/middleware/             → Auth, validation, rate limiting
src/contracts/checkout.ts                         → Type-safe contracts
```

**Key concepts:**
- **Middleware pattern:** Request flows through auth → validation → business logic
- **Revenue splits:** 88% farmer, 2% lead farmer, 10% platform
- **Stripe integration:** PaymentIntent creation and confirmation
- **Inventory validation:** Checks stock availability before order creation

### 3. Payment Processing
```
📁 Payment flow:
src/lib/stripe.ts                    → Stripe client setup
supabase/functions/stripe-webhook/   → Payment confirmation webhook
src/features/orders/                 → Order management
```

### 4. Database Schema
Check these tables in Lovable Cloud → Database:
- `shopping_carts` & `cart_items` → Shopping data
- `orders` & `order_items` → Order records
- `products` → Inventory
- `payouts` → Financial tracking

## 🗺️ Project Architecture Quick Tour

### Frontend Structure (`src/`)
```
features/           → Domain-driven feature modules
  ├── cart/         → Shopping cart
  ├── orders/       → Order management
  ├── products/     → Product catalog
  ├── consumers/    → Consumer features
  ├── farmers/      → Farmer features
  ├── drivers/      → Driver features
  └── admin/        → Admin features

pages/              → Route components
components/         → Shared UI components
lib/                → Utilities & helpers
contracts/          → Type-safe API contracts
```

### Backend Structure (`supabase/`)
```
functions/
  ├── checkout/                 → Order processing
  ├── generate-batches/         → Delivery optimization
  ├── process-payouts/          → Financial settlements
  └── _shared/
      ├── services/             → Business logic classes
      ├── middleware/           → Request processing
      └── contracts/            → Shared types
```

### Key Technologies
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (Postgres + Edge Functions) via Lovable Cloud
- **Payments:** Stripe Connect
- **State:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod validation
- **Testing:** Vitest + Playwright
- **UI:** shadcn/ui components

## 📚 Next Steps

Once you've explored the checkout flow:

1. **Read Architecture Docs**
   - [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
   - [API.md](./API.md) - Edge function reference
   - [SECURITY.md](./SECURITY.md) - Security model

2. **Explore Other Workflows**
   - Delivery batching: `supabase/functions/generate-batches/`
   - Payout processing: `supabase/functions/process-payouts/`
   - Driver routing: `src/features/drivers/`

3. **Run the Tests**
   ```bash
   npm run test:e2e       # See E2E flows in action
   ```

4. **Make Your First Change**
   - Try adding a new field to the checkout form
   - Update the revenue split percentages
   - Add a new product filter on the shop page

## 🐛 Common Issues

### Port Already in Use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 3000
```

### TypeScript Errors
```bash
# Regenerate Supabase types (if schema changed)
npm run type-check
```

### Authentication Issues
- Make sure you're using the correct test account credentials
- Check that RLS policies are enabled in the database
- Verify JWT tokens in browser DevTools → Application → Local Storage

### Edge Function Errors
```bash
# Check function logs
supabase functions logs <function-name>

# Common causes:
# - Missing environment variables
# - Invalid request payload
# - RLS policy blocking access
```

## 💡 Pro Tips

1. **Use React DevTools:** Install the React DevTools browser extension to inspect component state and props

2. **Use TanStack Query DevTools:** Already included - look for the flower icon in bottom-left corner to inspect query cache

3. **Use Supabase Studio:** Access your backend via Lovable Cloud → Backend button to:
   - Browse database tables
   - Test RLS policies
   - View function logs
   - Monitor real-time subscriptions

4. **Hot Module Reload:** Vite supports HMR - save a file and see changes instantly without refresh

5. **Type Safety:** This project uses strict TypeScript - let the compiler guide you. If it compiles, it usually works!

## 🆘 Need Help?

- **Documentation:** See [README.md](./README.md) for comprehensive docs
- **Feature Guides:** Each feature folder has its own README
- **API Reference:** Check [API.md](./API.md) for edge function specs
- **Contributing:** See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines

Happy coding! 🎉
