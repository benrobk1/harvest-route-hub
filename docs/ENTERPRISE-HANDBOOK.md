# Blue Harvests Enterprise Handbook

This handbook consolidates the expectations, controls, and operational playbooks required for enterprise readiness.

## Roles, Ownership & Access
- **Product Owners:** Define marketplace policies, payouts, and logistics SLAs.
- **Engineering Leads:** Own Supabase schema, edge functions, frontend UX, and release health.
- **Security/Compliance:** Own access reviews, data retention, vendor assessments, and incident coordination.
- **Access management:** All admin and operator accounts require SSO + least privilege. Supabase RLS enforces permissions for data access, and Stripe Connect isolates PCI scope.

## Environments
- **Local:** For feature development; uses anon Supabase keys and mock Stripe webhooks when needed.
- **Preview:** Per-PR deploys that mirror production config (except live payouts). Used for UAT and accessibility checks.
- **Production:** Full Stripe Connect, Resend notifications, and PagerDuty alerts. Admin role required for every privileged endpoint.

## Reliability & Observability
- **SLIs/SLOs:** Track checkout success rate, edge function latency, and driver route load times (see `docs/MONITORING.md`).
- **Logging/Tracing:** Supabase logs and client-side telemetry funnel into centralized dashboards; edge functions emit structured logs with request IDs.
- **Alerting:** PagerDuty/IM alerts fire on error-rate thresholds, failed Stripe webhooks, and batch-generation failures.

## Incident Response & Disaster Recovery
- **Triage:** Identify blast radius (consumer, farmer, driver), capture timestamps, and collect request IDs.
- **Rollback:** Prefer feature flags or config toggles; otherwise redeploy prior release artifacts.
- **Data Recovery:** Use Supabase backups and point-in-time recovery. Validate restored data with integrity checks on orders, payouts, and credits.
- **Postmortem:** Complete blameless review within 48 hours; document detection gaps and remediation owners.

## Security & Privacy
- **Data minimization:** Driver address reveal is progressive; PII is encrypted at rest via Supabase defaults.
- **Webhooks:** Stripe signatures verified in `supabase/functions/stripe-webhook/index.ts`; non-admin requests return `403`.
- **Secrets:** Stored in Lovable Cloud/Supabase secret stores. No secrets in source control; rotate keys quarterly or after incidents.
- **Hardening:** Follow [docs/SECURITY-HARDENING.md](./SECURITY-HARDENING.md) for TLS, CORS, and dependency scanning.

## Data Governance
- **Retention:** Order, payout, and audit records retained per contractual requirements; anonymize consumer data upon deletion requests.
- **Backups:** Verify automated backups weekly; document restore drills quarterly.
- **Change control:** Schema migrations reviewed in PRs and tested via preview environments before production promotion.

## Release Management
- **Branching:** Trunk-based with short-lived feature branches. All PRs require CI (lint, typecheck, build, tests).
- **Deployment:** Use `docs/DEPLOYMENT-CHECKLIST.md` for go-live gates, including Stripe webhook validation and monitoring verification.
- **Feature Flags:** Gate new flows (e.g., AI batching) behind flags for controlled rollout.

## Operational Runbooks
- **Batch generation failure:** Check edge function logs, verify Mapbox/OSRM tokens, and fall back to geographic grouping.
- **Payment issues:** Validate Stripe webhook health, reconcile payouts via dashboard, and retry failed intents.
- **Notification failures:** Review Resend quotas/keys; rerun notification jobs once keys are restored.

## Audit & Compliance Readiness
- Maintain evidence of deployment approvals, backup verification, and dependency scans.
- Ensure SSO enforced for admin dashboards and operational tooling.
- Perform quarterly access reviews of Supabase roles, Stripe Connect accounts, and monitoring tooling.
