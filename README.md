# 🌾 Blue Harvests - Local Farm-to-Table Marketplace

> **Documentation Version**: November 2025  
> **Project Status**: Production-ready, active development  
> **If anything seems outdated**: Check Git history or ask maintainers

A modern, full-stack platform connecting local farmers with consumers through efficient delivery coordination. Built with React, TypeScript, and Supabase, featuring real-time tracking, automated batch optimization, and comprehensive payment processing.

**Project URL**: https://lovable.dev/projects/eeae09ce-f16e-41fa-a46e-2dadc2102e6c

[![CI Status](https://github.com/YOUR_USERNAME/YOUR_REPO/workflows/CI/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions)

## 📚 Documentation Guide

**New to the project?** Start here:
1. [QUICKSTART.md](./QUICKSTART.md) - Get running in 5 minutes
2. [DATABASE.md](./DATABASE.md) - Understand the data model
3. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design deep-dive

**For developers:**
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development workflow
- [API.md](./API.md) - Edge function reference
- [SECURITY.md](./SECURITY.md) - Security architecture
- [src/features/README.md](./src/features/README.md) - Code organization

**Technical Guides (docs/):**
- [Middleware Pattern](./docs/MIDDLEWARE.md) - Edge function middleware
- [Monitoring & Observability](./docs/MONITORING.md) - Error tracking & logging
- [Testing Strategy](./docs/TESTING.md) - Unit, integration, E2E tests
- [Mobile Apps](./docs/MOBILE.md) - PWA and native setup
- [Deployment](./docs/DEPLOYMENT-CHECKLIST.md) - Production checklist
- [Performance](./docs/PERFORMANCE-OPTIMIZATION.md) - Optimization guide
- [Security Hardening](./docs/SECURITY-HARDENING.md) - Advanced security

**Reference:**
- Feature READMEs in `src/features/*/README.md`
- [Error Handling Guide](./src/lib/errors/README.md)

---

## ⚡ Happy Path (30 Seconds)

**First-time reviewers**: Get the full platform running in under 60 seconds:

```bash
# 1. Seed demo data (creates test accounts + orders)
npm run seed

# 2. Sign in as consumer
# Email: test-consumer@example.com | Password: password123
# Navigate to /consumer/shop

# 3. Add items to cart → Checkout
# Use test card: 4242 4242 4242 4242 | Any future date | Any CVC

# 4. Admin generates batches
# Navigate to /admin/dashboard → Click "Generate Batches"

# 5. Driver completes delivery
# Navigate to /driver/routes → Accept batch → Scan box code → Mark delivered
```

**Result**: You've now seen the complete lifecycle: consumer order → AI batch optimization → driver delivery → automated payouts.

---

## 🚀 Demo Prep (First-Time Setup)

### Required Environment Variables

All secrets are pre-configured in Lovable Cloud. For local development, you'll need:

```bash
# Automatically provided by Lovable Cloud:
VITE_SUPABASE_URL=<your-project-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>

# Backend secrets (configured in Lovable Cloud Secrets UI):
STRIPE_SECRET_KEY=<your-stripe-secret>        # Required for payments
MAPBOX_PUBLIC_TOKEN=<your-mapbox-token>       # Optional (geocoding fallback enabled)
LOVABLE_API_KEY=<your-lovable-key>           # Optional (geographic batching fallback enabled)
OSRM_SERVER_URL=<osrm-server>                # Optional (route optimization)
RESEND_API_KEY=<your-resend-key>             # Optional (email notifications)
```

### Demo Data Seeding

**Option 1: Full Demo Reset** (Recommended for demos)
```bash
npm run seed              # Creates 50+ orders, 10+ farmers, realistic data
```

This script (`scripts/seed-demo.ts`) creates:
- 3 test users (consumer, farmer, driver)
- 20+ products across multiple farms
- 50+ orders with varied statuses
- Delivery batches with optimized routes
- Credits ledger transactions
- Subscription data

**Option 2: Reset to Clean State** (via Admin Dashboard)
- Navigate to `/admin/dashboard`
- Click "Reset Demo Data" button
- Calls `reset-demo-data` edge function

### Test Accounts

See [QUICKSTART.md](./QUICKSTART.md#-test-accounts) for test credentials and demo card details.

### Security Notes

**Sensitive endpoints require admin authentication:**
- All admin functions validate JWT + `admin` role
- Non-admin requests return `403 Forbidden`
- Rate limiting enforced on all sensitive operations

**Address privacy:**
- Driver queries use secure views that mask addresses
- Progressive disclosure: addresses reveal as deliveries progress
- Database-level protection against premature exposure

See [`SECURITY.md`](./SECURITY.md) for complete security architecture.

### Webhook Configuration

**Stripe webhooks** are pre-configured in Lovable Cloud deployment:
- Production: Automatically configured when you deploy
- Local dev: **Skip webhook setup** - not required for core functionality
- See `supabase/functions/stripe-webhook/index.ts` for implementation details

**What webhooks handle** (post-demo):
- `payment_intent.succeeded` → Update order status to 'paid'
- `customer.subscription.updated` → Sync subscription credits
- `charge.dispute.created` → Alert admin for review
- `payout.failed` → Retry payout logic

**Security**: All webhooks verify Stripe signature using `STRIPE_WEBHOOK_SECRET` before processing events.

---

## 🎯 Key Features

✅ **Dual-Path Batch Optimization** - AI-powered (Gemini 2.5) with deterministic geographic fallback  
✅ **Automated Revenue Distribution** - 88% farmer / 2% lead farmer / 10% platform, calculated automatically  
✅ **Credits System** - Earn $10 credit per $100 spent (subscription members only)  
✅ **Stripe Connect** - Automated farmer payouts with 1099 generation  
✅ **Mobile-First PWA** - Offline cart support, installable on iOS/Android  
✅ **Real-Time Tracking** - Order status updates via Supabase Realtime  
✅ **Role-Based Access Control** - Secure multi-tenant architecture with RLS policies

## 🎯 Quick Demo

For a detailed 5-minute walkthrough of all user flows, see [QUICKSTART.md](./QUICKSTART.md#-first-feature-to-explore).

---

## 🏗️ Architecture Overview

### System Design (30-Second Map)

```
Consumers → Shop → Cart → Checkout → Stripe Payment
                                    ↓
                              Order Created
                                    ↓
                    AI Batch Optimization (daily cron)
                     ↓                    ↓
              Gemini 2.5 Flash      Geographic Fallback
              (optimal routes)      (ZIP-based grouping)
                     ↓                    ↓
                    Driver Dashboard (pick route)
                                    ↓
                          Box Code Scanning
                                    ↓
                         Delivery Completion
                                    ↓
                    Automated Payouts (Stripe Connect)
                     ↓              ↓              ↓
                  Farmer 88%   Lead Farmer 2%  Platform 10%
```

### Critical Demo Route

**Consumer Journey** (2 min):
1. `/shop` - Browse products, add to cart
2. `/consumer/checkout` - Select delivery date, apply credits
3. Complete Stripe payment (test card: 4242...)
4. `/consumer/orders` - Track order status in real-time

**Admin Batch Creation** (30 sec):
1. Navigate to `/admin/dashboard`
2. Click "Generate Batches" (calls `generate-batches` edge function)
3. View optimized routes grouped by ZIP + AI optimization

**Driver Delivery** (1 min):
1. `/driver/routes` - Accept batch assignment
2. `/driver/load-boxes` - Scan QR codes to confirm pickup
3. `/driver/route/:id` - Follow optimized route with map
4. Mark stops as delivered (triggers address reveal for next 3 stops)

### Key Technical Decisions

**Why addresses are hidden from drivers initially:**
- **Privacy-first design** - Consumer addresses only revealed when driver starts route
- **Progressive disclosure** - Next 3 addresses unlock as each stop completes
- **RLS enforcement** - Database-level access control via `get_consumer_address()` function

**Why batch sizes have caps (30-45 orders):**
- **Driver workload** - 7.5 hour route maximum prevents burnout
- **Subsidization threshold** - Batches <30 orders may need platform subsidy
- **Quality control** - Larger batches risk delivery delays and quality issues

**Why geographic fallback exists:**
- **Reliability** - If Lovable AI API is down, system continues operating
- **Cost optimization** - AI only used when needed (complex multi-ZIP batches)
- **Performance** - Simple ZIP grouping is instant for small batches

---


---

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/eeae09ce-f16e-41fa-a46e-2dadc2102e6c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/eeae09ce-f16e-41fa-a46e-2dadc2102e6c) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
