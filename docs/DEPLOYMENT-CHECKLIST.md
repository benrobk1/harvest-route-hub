# Production Deployment Checklist

> **Last Updated**: November 2025  
> **Version**: 1.0  
> **Purpose**: Comprehensive pre-deployment verification and deployment procedures

## Overview

This checklist ensures all critical systems are verified before deploying to production. Each section must be completed and signed off before proceeding.

---

## 📋 Pre-Deployment Checklist

### 1. Security Verification ✅

- [ ] **RLS Policies Enabled**
  - Run Supabase linter: `npm run security:check`
  - Verify all tables have RLS enabled
  - Test policies with different user roles
  - Document: [SECURITY.md](../SECURITY.md)

- [ ] **Secrets Management**
  - All API keys stored in Supabase Vault (not in code)
  - Stripe keys set to LIVE mode (not test mode)
  - Tax encryption key rotated and documented
  - Verify with: `supabase secrets list`

- [ ] **API Key Rotation**
  - Review API key versions in `api_keys` table
  - Expire test/development keys
  - Enable automated rotation schedule
  - Document: [SECURITY-HARDENING.md](./SECURITY-HARDENING.md)

- [ ] **Webhook Security**
  - Stripe signature verification enabled
  - IP allowlisting configured for webhooks
  - Replay attack prevention active (check `webhook_logs`)
  - Test with: `curl` to webhook endpoints

- [ ] **Rate Limiting**
  - Verify rate limits in all edge functions
  - Test with load testing scripts
  - Confirm Redis/memory cache configured
  - Document: [LOAD-TESTING.md](./LOAD-TESTING.md)

- [ ] **Authentication**
  - Email confirmation enabled (or disabled for dev)
  - OAuth providers configured and tested
  - Password policies enforced
  - Admin role assignment process verified

- [ ] **CORS Configuration**
  - Admin endpoints restricted to production domain
  - Public endpoints allow appropriate origins
  - Preflight OPTIONS handlers working

### 2. Database & Migrations ✅

- [ ] **Schema Validation**
  - All migrations applied successfully
  - No pending migrations: `supabase db push --dry-run`
  - Foreign key constraints validated
  - Indexes created for high-traffic queries

- [ ] **Data Integrity**
  - Run data validation queries
  - Check for orphaned records
  - Verify referential integrity
  - Test cascade deletes

- [ ] **Backup Strategy**
  - Automatic daily backups enabled (Supabase default)
  - Manual backup before deployment
  - Point-in-time recovery tested
  - Backup retention policy: 30 days

- [ ] **Performance**
  - Query performance analyzed (no queries >1s)
  - Indexes optimized for common queries
  - Connection pooling configured
  - Document: [PERFORMANCE-OPTIMIZATION.md](./PERFORMANCE-OPTIMIZATION.md)

### 3. Testing & Quality Assurance ✅

- [ ] **Unit Tests**
  - All tests passing: `npm test`
  - Coverage >80% for critical paths
  - No skipped/ignored tests in production code

- [ ] **Integration Tests**
  - E2E tests passing: `npm run test:e2e`
  - Test scenarios:
    - Consumer checkout flow
    - Farmer product management
    - Driver route claiming
    - Admin batch generation
    - Subscription management

- [ ] **Load Testing**
  - Sustained load test (100 RPS for 5 min)
  - Spike test (0 → 500 RPS)
  - Stress test (ramp to failure point)
  - Document results in [LOAD-TESTING.md](./LOAD-TESTING.md)

- [ ] **Edge Function Tests**
  - All edge functions tested with `deno test`
  - Webhook handlers tested with sample payloads
  - Error handling verified
  - Timeout scenarios tested

### 4. Frontend & UI ✅

- [ ] **Build Validation**
  - Production build succeeds: `npm run build`
  - No build warnings or errors
  - Bundle size analyzed: `npm run preview`
  - Lighthouse score >90 (Performance, Accessibility)

- [ ] **Cross-Browser Testing**
  - Chrome/Edge (latest)
  - Firefox (latest)
  - Safari (latest)
  - Mobile browsers (iOS Safari, Chrome Android)

- [ ] **Responsive Design**
  - Test on mobile (320px - 768px)
  - Test on tablet (768px - 1024px)
  - Test on desktop (1024px+)
  - Test landscape/portrait orientations

- [ ] **Accessibility**
  - WCAG 2.1 AA compliance
  - Keyboard navigation working
  - Screen reader tested (NVDA/VoiceOver)
  - Color contrast ratios meet standards

- [ ] **PWA Features**
  - Service worker registered
  - Install prompt working
  - Offline functionality tested
  - Push notifications configured

### 5. Performance & Optimization ✅

- [ ] **Caching**
  - Edge function caching enabled
  - Browser caching headers configured
  - CDN caching strategy defined
  - Cache invalidation tested

- [ ] **Asset Optimization**
  - Images compressed and optimized
  - Lazy loading implemented
  - Code splitting configured
  - Unused dependencies removed

- [ ] **API Performance**
  - Response times <500ms for critical endpoints
  - Database queries optimized
  - N+1 query problems resolved
  - Batch operations implemented where needed

### 6. Monitoring & Observability ✅

- [ ] **Sentry Configuration**
  - Production DSN configured
  - Source maps uploaded
  - Release tracking enabled
  - User feedback widget configured

- [ ] **Custom Metrics**
  - Edge function metrics collecting
  - Business KPIs tracking
  - Performance metrics baseline established
  - Document: [MONITORING.md](./MONITORING.md)

- [ ] **Alerting Rules**
  - Error rate alerts (>1% in 5 min)
  - Response time alerts (>1s p95)
  - Database connection alerts
  - Failed payment alerts
  - Webhook failure alerts

- [ ] **Log Aggregation**
  - Structured logging implemented
  - Log retention policy: 30 days
  - Critical errors routed to alerting
  - PII redacted from logs

### 7. Third-Party Integrations ✅

- [ ] **Stripe**
  - Live mode keys configured
  - Webhook endpoints verified
  - Test transactions in live mode
  - Dispute handling process tested
  - Payout schedule configured

- [ ] **Email Service (Resend)**
  - Production API key configured
  - Email templates tested
  - Unsubscribe links working
  - SPF/DKIM records configured

- [ ] **Maps (Mapbox)**
  - Production token configured
  - Rate limiting understood
  - Geocoding fallbacks tested
  - OSRM routing validated

- [ ] **Analytics**
  - Tracking events verified
  - Conversion funnels configured
  - Privacy policy updated
  - GDPR compliance verified

### 8. Legal & Compliance ✅

- [ ] **Terms of Service**
  - Current version deployed
  - Acceptance tracking implemented
  - Changes logged and versioned

- [ ] **Privacy Policy**
  - GDPR compliance verified
  - Cookie consent implemented
  - Data retention policies documented
  - User data deletion process tested

- [ ] **PCI Compliance**
  - Stripe handles all card data
  - No card data stored in database
  - SSL/TLS configured correctly
  - Security audit completed

- [ ] **Tax Compliance**
  - 1099 generation tested
  - Tax ID encryption verified
  - 7-year retention policy configured
  - Document: [SECURITY.md](../SECURITY.md)

### 9. Business Logic ✅

- [ ] **Order Processing**
  - Cutoff time logic verified (Friday 5 PM)
  - Batch generation tested
  - Route optimization working
  - Driver assignment logic correct

- [ ] **Payment Processing**
  - Checkout flow end-to-end tested
  - Refund process verified
  - Failed payment handling tested
  - Subscription billing working

- [ ] **Payout System**
  - Farmer payout calculations verified
  - Driver earnings calculations correct
  - Stripe Connect onboarding tested
  - Payout processing tested

- [ ] **Credit System**
  - Referral credits working
  - Spending threshold calculations correct
  - Credit expiration logic verified
  - Credit history tracking accurate

---

## 🚀 Deployment Steps

### Phase 1: Pre-Deployment (T-24 hours)

1. **Create Deployment Branch**
   ```bash
   git checkout -p production
   git pull origin main
   git push origin production
   ```

2. **Run Full Test Suite**
   ```bash
   npm test
   npm run test:e2e
   npm run security:check
   ```

3. **Generate Deployment Report**
   - Document all changes since last deployment
   - List new features and bug fixes
   - Identify potential risks
   - Create rollback plan

4. **Notify Stakeholders**
   - Send deployment announcement
   - Schedule maintenance window (if needed)
   - Prepare support team

### Phase 2: Database Migration (T-1 hour)

1. **Backup Current Database**
   ```bash
   # Supabase handles automatic backups
   # Verify backup exists in dashboard
   ```

2. **Run Migrations (Dry Run)**
   ```bash
   supabase db push --dry-run
   ```

3. **Apply Migrations**
   ```bash
   supabase db push
   ```

4. **Verify Migration Success**
   ```sql
   -- Check migration history
   SELECT * FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC LIMIT 10;
   ```

### Phase 3: Edge Function Deployment (T-30 minutes)

1. **Deploy Edge Functions**
   ```bash
   supabase functions deploy --project-ref xushmvtkfkijrhfoxhat
   ```

2. **Verify Function Health**
   ```bash
   # Test each critical function
   curl -X POST https://xushmvtkfkijrhfoxhat.supabase.co/functions/v1/check-subscription \
     -H "Authorization: Bearer $ANON_KEY"
   ```

3. **Monitor Function Logs**
   - Check for startup errors
   - Verify environment variables loaded
   - Test rate limiting

### Phase 4: Frontend Deployment (T-15 minutes)

1. **Build Production Bundle**
   ```bash
   npm run build
   ```

2. **Deploy to Lovable/Hosting Provider**
   - Click "Update" in Lovable publish dialog
   - OR deploy to custom hosting (Vercel, Netlify, etc.)

3. **Verify Deployment**
   - Check homepage loads
   - Test critical user flows
   - Verify API connectivity

### Phase 5: Post-Deployment Verification (T+0)

1. **Smoke Tests**
   - [ ] Homepage loads correctly
   - [ ] User can sign up/login
   - [ ] Consumer can browse products
   - [ ] Farmer can add products
   - [ ] Driver can view routes
   - [ ] Admin can access dashboard
   - [ ] Checkout flow completes
   - [ ] Payment processing works

2. **Health Checks**
   ```bash
   # Check edge function health
   curl https://xushmvtkfkijrhfoxhat.supabase.co/functions/v1/get-metrics
   
   # Check database connectivity
   curl https://xushmvtkfkijrhfoxhat.supabase.co/rest/v1/
   ```

3. **Monitor Key Metrics** (First 30 minutes)
   - Error rate (should be <0.5%)
   - Response times (p95 <1s)
   - Active user sessions
   - Database connection pool
   - Edge function invocations

4. **Review Logs**
   - Check Sentry for new errors
   - Review edge function logs
   - Monitor database logs
   - Check webhook logs

### Phase 6: Communication (T+1 hour)

1. **Announce Deployment Complete**
   - Update status page
   - Notify stakeholders
   - Post on social media (if applicable)

2. **Document Deployment**
   - Record deployment time
   - Note issues encountered
   - Update runbook with lessons learned

---

## 🔄 Rollback Procedures

### When to Rollback

Rollback immediately if:
- Error rate >5% for 5 minutes
- Critical feature completely broken
- Data integrity issues detected
- Security vulnerability introduced

### Rollback Steps

#### Frontend Rollback

1. **Revert to Previous Version**
   - In Lovable: Use version history to restore
   - In GitHub: `git revert <commit-hash>` and redeploy

2. **Verify Rollback**
   - Test critical user flows
   - Check error rates normalize
   - Confirm no new issues introduced

#### Edge Function Rollback

1. **Redeploy Previous Version**
   ```bash
   git checkout <previous-commit>
   supabase functions deploy
   ```

2. **Verify Function Health**
   ```bash
   # Test critical endpoints
   ./scripts/test-edge-functions.sh
   ```

#### Database Rollback

**WARNING**: Database rollbacks are high-risk. Only perform if absolutely necessary.

1. **Restore from Backup**
   ```bash
   # Contact Supabase support or use dashboard
   # Point-in-time recovery available
   ```

2. **Revert Migration**
   ```sql
   -- Only if migration is reversible
   -- Create down migration and apply
   ```

3. **Verify Data Integrity**
   - Run validation queries
   - Check foreign key constraints
   - Test critical operations

---

## 📊 Post-Deployment Monitoring (First 24 Hours)

### Hour 1: Intensive Monitoring

- [ ] Check Sentry every 15 minutes
- [ ] Monitor error rates and response times
- [ ] Review user feedback channels
- [ ] Watch database performance

### Hours 2-8: Active Monitoring

- [ ] Check Sentry every hour
- [ ] Review business metrics
- [ ] Monitor payment processing
- [ ] Check webhook delivery rates

### Hours 8-24: Standard Monitoring

- [ ] Check Sentry every 4 hours
- [ ] Review daily metrics
- [ ] Check for pattern changes
- [ ] Document anomalies

### Metrics to Track

1. **Application Health**
   - Error rate: Target <0.5%
   - Response time p95: Target <1s
   - Uptime: Target 99.9%

2. **Business Metrics**
   - Order completion rate: Target >95%
   - Payment success rate: Target >98%
   - User registration rate
   - Active sessions

3. **Technical Metrics**
   - Edge function cold starts
   - Database connection pool usage
   - Cache hit rates
   - API rate limit hits

---

## 🎯 Success Criteria

Deployment is considered successful when:

- [ ] All smoke tests passing
- [ ] Error rate <0.5% for 1 hour
- [ ] Response times within targets
- [ ] No critical bugs reported
- [ ] Payment processing working
- [ ] All integrations operational
- [ ] Monitoring and alerting active
- [ ] Team confirms stability

---

## 📞 Emergency Contacts

### Immediate Response (Severity 1)
- **On-Call Engineer**: [Contact Info]
- **Tech Lead**: [Contact Info]
- **Deployment Slack Channel**: #deployments

### Escalation (30+ minutes unresolved)
- **Engineering Manager**: [Contact Info]
- **CTO**: [Contact Info]

### Third-Party Support
- **Supabase Support**: support@supabase.io
- **Stripe Support**: Dashboard → Support
- **Sentry Support**: Dashboard → Help

---

## 📝 Deployment Template

Copy this template for each deployment:

```markdown
## Deployment: [Date] - [Version]

**Deployed By**: [Name]
**Deployment Time**: [Start] - [End]
**Environment**: Production

### Changes Included
- [ ] Feature: [Description]
- [ ] Bugfix: [Description]
- [ ] Performance: [Description]

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Load testing completed
- [ ] Stakeholders notified

### Deployment Steps Completed
- [ ] Database migrations applied
- [ ] Edge functions deployed
- [ ] Frontend deployed
- [ ] Smoke tests passed

### Post-Deployment Status
- [ ] Error rate within limits
- [ ] Response times acceptable
- [ ] No critical issues
- [ ] Monitoring active

### Issues Encountered
[None / List issues and resolutions]

### Rollback Performed
[No / Yes - Reason and steps]

### Next Steps
[Any follow-up actions needed]
```

---

## 🔗 Related Documentation

- [Architecture Overview](../ARCHITECTURE.md)
- [Security Model](../SECURITY.md)
- [Database Schema](../DATABASE.md)
- [Performance Optimization](./PERFORMANCE-OPTIMIZATION.md)
- [Security Hardening](./SECURITY-HARDENING.md)
- [Load Testing Guide](./LOAD-TESTING.md)
- [Monitoring Guide](./MONITORING.md)
- [Operational Runbook](./RUNBOOK.md)

---

## 📅 Maintenance Schedule

### Pre-Deployment Reviews
- **Weekly**: Team deployment sync
- **Monthly**: Security audit review
- **Quarterly**: Disaster recovery drill

### Regular Updates
- **Checklist Review**: Monthly
- **Process Improvements**: After each deployment
- **Documentation Updates**: As needed

---

**Remember**: A successful deployment is not just about getting code live—it's about ensuring stability, performance, and a great user experience. When in doubt, delay and verify rather than rush and rollback.
