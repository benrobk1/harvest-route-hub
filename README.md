# Blue Harvests - Local Food Delivery Platform

**A full-stack marketplace connecting local farmers with consumers, featuring AI-powered logistics optimization.**

**Project URL**: https://lovable.dev/projects/eeae09ce-f16e-41fa-a46e-2dadc2102e6c

---

## 🎯 Quick Demo (5 Minutes)

This project demonstrates a production-ready marketplace with multi-role workflows, automated batch optimization, and real-time order tracking.

### Demo Script (YC-Ready)

#### 1. **Consumer Flow** (2 min)
- Browse farmer products at `/shop`
- Add items to cart with real-time inventory updates
- Apply credits at checkout (earn $10 per $100 spent)
- Complete payment with Stripe test card: `4242 4242 4242 4242`
- View live order tracking with status updates

#### 2. **Farmer Flow** (1 min)
- Login as farmer at `/farmer-auth`
- Upload products via CSV bulk import or manual form
- View real-time earnings dashboard with 88% revenue share
- Track order fulfillment and customer analytics

#### 3. **Driver Flow** (1 min)
- Login as driver at `/driver-auth`
- View AI-optimized delivery batches (auto-generated daily)
- Scan box codes with camera to confirm pickup
- Complete optimized route with GPS navigation
- Track earnings ($7.50 per delivery + tips)

#### 4. **Admin Flow** (1 min)
- View KPIs: revenue splits (88/2/10), batch efficiency, growth metrics
- Approve pending products and new users
- Generate 1099 tax forms for contractors (farmers & drivers)
- Monitor system health and subsidized batches

### Test Accounts

Run the seed script to create demo data:
```bash
npm run seed
```

**Test Credentials**:
```
Consumer: test-consumer@example.com / password123
Farmer:   test-farmer@example.com / password123
Driver:   test-driver@example.com / password123
Admin:    test-admin@example.com / password123
```

### Key Features to Highlight

✅ **Dual-Path Batch Optimization** - AI-powered (Gemini 2.5) with deterministic geographic fallback  
✅ **Automated Revenue Distribution** - 88% farmer / 2% lead farmer / 10% platform, calculated automatically  
✅ **Credits System** - Earn $10 credit per $100 spent (subscription members only)  
✅ **Stripe Connect** - Automated farmer payouts with 1099 generation  
✅ **Mobile-First PWA** - Offline cart support, installable on iOS/Android  
✅ **Real-Time Tracking** - Order status updates via Supabase Realtime  
✅ **Role-Based Access Control** - Secure multi-tenant architecture with RLS policies  

---

## 📚 Documentation

- **[Architecture Guide](./ARCHITECTURE.md)** - System design, data flows, and technical decisions
- [Testing Guide](./README-TESTING.md) - Test runner instructions and E2E scenarios
- [PWA Setup](./README-PWA.md) - Progressive Web App features and installation
- [Capacitor Setup](./README-CAPACITOR.md) - Native mobile app build instructions

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
