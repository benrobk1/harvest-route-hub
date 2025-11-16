# 🌾 Blue Harvests Enterprise Handbook

Blue Harvests is a production-grade, farm-to-table marketplace that connects local farmers, drivers, and consumers with real-time logistics, automated payouts, and transparent governance. The platform runs on React, TypeScript, Supabase, and Stripe Connect, with observability, security, and compliance controls suitable for enterprise deployments.

## 📑 Documentation Map
- **Enterprise posture:** [docs/ENTERPRISE-HANDBOOK.md](./docs/ENTERPRISE-HANDBOOK.md) (governance, security, operations, SLAs)
- **Architecture deep dives:** [ARCHITECTURE.md](./ARCHITECTURE.md) and [ARCHITECTURE-FEATURES.md](./ARCHITECTURE-FEATURES.md)
- **Data model & migrations:** [DATABASE.md](./DATABASE.md)
- **API contracts:** [API.md](./API.md) and feature READMEs under `src/features/*/README.md`
- **Edge/security guides:** [SECURITY.md](./SECURITY.md), [docs/SECURITY-HARDENING.md](./docs/SECURITY-HARDENING.md)
- **Testing & quality:** [docs/TESTING.md](./docs/TESTING.md), [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Operational playbooks:** [docs/MONITORING.md](./docs/MONITORING.md), [docs/DEPLOYMENT-CHECKLIST.md](./docs/DEPLOYMENT-CHECKLIST.md)

## 🚀 Environments & Access
| Environment | Purpose | Entry point | Notes |
| --- | --- | --- | --- |
| Local | Developer workstation | `npm run dev` | Uses `.env.local` with Supabase anon key; Stripe webhook emulation optional. |
| Preview | Per-PR validation | Vercel/Lovable preview URLs | Mirrors production configs minus live payouts. |
| Production | Customer-facing | https://lovable.dev/projects/eeae09ce-f16e-41fa-a46e-2dadc2102e6c | Enforces admin role-based access, Stripe Connect, and monitoring alerts. |

Secrets are managed via Lovable Cloud / Supabase. Stripe and Resend credentials are required for payment and notification flows; Mapbox and OSRM tokens optimize routing but are optional.

## 🏁 Quickstart (Local Development)
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and populate Supabase URL + anon key, plus Stripe/Mapbox tokens if testing those paths.
3. Run database migrations/seed (optional but recommended): `npm run seed`
4. Start the app: `npm run dev`
5. Visit `/shop` (consumer), `/admin/dashboard` (admin), `/driver/routes` (driver) to validate core personas.

## 🔐 Security & Compliance Snapshot
- Role-based Supabase policies gate all privileged data; admin-only endpoints return `403` when misused.
- Stripe Connect handles PII/PCI scope; webhook signatures are enforced in `supabase/functions/stripe-webhook/index.ts`.
- Addresses reveal progressively to drivers to minimize exposure (documented in `SECURITY.md`).
- Auditability: event logging and monitoring are outlined in [docs/MONITORING.md](./docs/MONITORING.md).

## 🛠️ Architecture Overview
- **Frontend:** Vite + React + Tailwind + shadcn-ui. Feature modules live under `src/features/*`.
- **Backend:** Supabase (Postgres, Auth, Edge Functions). Business logic in `supabase/functions/*` and `src/lib/*`.
- **Integrations:** Stripe payments/payouts, Mapbox/OSRM for routing, Resend for notifications.
- **Batch & logistics:** Dual-path optimization (AI + geographic fallback) with QR-based box scanning and credits ledger automation.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for sequence diagrams, failure modes, and data flow details.

## 🧪 Quality Gates
- Unit/integration tests via `npm test` and Vitest; E2E via Playwright.
- CI enforces lint (`npm run lint`), type-check (`npm run typecheck`), and build (`npm run build`).
- Release readiness follows [docs/DEPLOYMENT-CHECKLIST.md](./docs/DEPLOYMENT-CHECKLIST.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## 🩺 Operations & Runbooks
- Monitoring/alerts: see [docs/MONITORING.md](./docs/MONITORING.md) for SLIs, dashboards, and PagerDuty routing.
- Incident response: production rollback and data-restore paths are documented in [docs/ENTERPRISE-HANDBOOK.md](./docs/ENTERPRISE-HANDBOOK.md#incident-response--disaster-recovery).
- Oncall escalation: create incidents in the chosen IM channel; all critical logs are centralized via Supabase.

## 🤝 Support & Contact
- **Product owners:** Marketplace operations (farmer/driver/consumer workflows)
- **Engineering leads:** Supabase backend, logistics optimization, frontend UX
- **Security/Compliance:** Data retention, least-privilege reviews, vendor risk

For access requests or escalation paths, refer to [docs/ENTERPRISE-HANDBOOK.md](./docs/ENTERPRISE-HANDBOOK.md#roles-ownership--access).
