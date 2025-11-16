# Operations Runbook

Quick reference guide for common operational tasks and troubleshooting.

## Emergency Contacts

- **On-Call Engineer**: [Slack: #engineering-oncall]
- **DevOps Lead**: [Contact info]
- **Database Admin**: [Contact info]
- **Security Team**: [Contact info]

## Quick Links

- **Production App**: https://your-app.lovableproject.com
- **Sentry**: https://sentry.io/your-org/your-project
- **Backend**: [Access via Lovable Cloud UI]
- **GitHub**: https://github.com/your-org/your-repo
- **Status Page**: [If applicable]

---

## Common Issues & Solutions

### 1. Site is Down / 500 Errors

**Symptoms**: Users cannot access the site, 500 errors in Sentry

**Investigation**:
```bash
# Check edge function logs
# Via Lovable Cloud UI: Navigate to Cloud → Functions → View Logs

# Check database connectivity
# Via Lovable Cloud UI: Cloud → Database → Check connection status

# Check recent deployments
git log --oneline -5
```

**Resolution**:
```bash
# Option 1: Rollback to previous version
# Via Lovable Cloud UI: Deployments → Previous version → Restore

# Option 2: Check edge function errors
# Fix error in edge function code
# Deploy will happen automatically
```

**Escalate if**: Issue persists after rollback

---

### 2. Checkout Not Working

**Symptoms**: Users report checkout failures, high error rate on `/checkout`

**Investigation**:
```bash
# Check Stripe status
curl https://status.stripe.com/api/v2/status.json

# Check edge function logs for 'checkout'
# Look for Stripe API errors or timeouts

# Check database for order creation failures
# Via Lovable Cloud UI: Cloud → Database → Run query:
# SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 hour' AND status = 'failed'
```

**Resolution**:
```typescript
// If Stripe is down:
// 1. Enable maintenance mode message
// 2. Queue orders for later processing
// 3. Notify users of delay

// If database issue:
// 1. Check RLS policies
// 2. Verify user authentication
// 3. Check for constraint violations
```

**Prevention**: Implement retry logic and circuit breaker for Stripe

---

### 3. Slow Performance / High Latency

**Symptoms**: Users report slow page loads, P95 latency > 3s

**Investigation**:
```bash
# Check recent performance metrics
npm run scripts/performance-benchmark.js

# Identify slow queries via Backend UI
# Cloud → Database → Performance → Slow Queries

# Check edge function duration
# Cloud → Functions → Select function → Performance
```

**Resolution**:
```sql
-- Add missing indexes
CREATE INDEX idx_orders_consumer_created 
ON orders(consumer_id, created_at DESC);

-- Analyze query plans
EXPLAIN ANALYZE 
SELECT * FROM orders 
WHERE consumer_id = 'user-id' 
ORDER BY created_at DESC;
```

**Quick Fixes**:
- Increase instance size (Cloud → Advanced Settings)
- Clear CDN cache
- Restart edge functions (automatic on deploy)

---

### 4. User Authentication Issues

**Symptoms**: Users cannot log in, JWT errors

**Investigation**:
```bash
# Check auth logs via Backend UI
# Cloud → Authentication → Logs

# Verify JWT secret is set
# Cloud → Settings → Check JWT configuration

# Check user status
# Cloud → Authentication → Users → Search user
```

**Resolution**:
```typescript
// Common fixes:
// 1. Clear user's session: DELETE FROM auth.sessions WHERE user_id = 'xxx'
// 2. Verify email: UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = 'xxx'
// 3. Reset password: Trigger password reset flow
```

---

### 5. Payment Processing Failures

**Symptoms**: Payments failing, Stripe webhook errors

**Investigation**:
```bash
# Check Stripe dashboard
# Look for webhook delivery failures

# Check edge function logs for 'stripe-webhook'
# Cloud → Functions → stripe-webhook → Logs

# Verify webhook secret
# Cloud → Secrets → Check STRIPE_WEBHOOK_SECRET
```

**Resolution**:
```bash
# Re-sync webhook secret
# 1. Get from Stripe dashboard
# 2. Update in Lovable Cloud: Cloud → Secrets → Update

# Retry failed webhooks from Stripe dashboard
```

---

### 6. Database Connection Errors

**Symptoms**: `Could not connect to database`, connection pool exhausted

**Investigation**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check for long-running queries
SELECT pid, age(clock_timestamp(), query_start), query
FROM pg_stat_activity
WHERE query != '<IDLE>' AND query NOT ILIKE '%pg_stat_activity%'
ORDER BY age DESC;
```

**Resolution**:
```sql
-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE age(clock_timestamp(), query_start) > interval '5 minutes';

-- Increase connection pool size
-- Cloud → Database → Advanced → Connection Pool Size
```

---

### 7. High Error Rate in Sentry

**Symptoms**: Sudden spike in Sentry errors

**Investigation**:
1. Check Sentry dashboard for error patterns
2. Identify if errors are user-specific or global
3. Check if related to recent deployment
4. Review error stack traces

**Resolution**:
```bash
# If deployment-related:
# Rollback to previous version

# If code issue:
# Fix bug and deploy
# Mark Sentry issue as resolved

# If external service:
# Implement graceful degradation
# Add better error messages
```

---

## Routine Maintenance

### Daily Checks (15 minutes)

```bash
# 1. Check Sentry for new critical errors
# Visit: Sentry → Issues → Filter: Unresolved

# 2. Review edge function health
# Cloud → Functions → Check all functions are healthy

# 3. Verify scheduled jobs ran
# Cloud → Functions → Check cron job logs

# 4. Quick performance check
# Visit site, test critical paths: Shop → Add to cart → Checkout
```

### Weekly Tasks (1 hour)

```bash
# 1. Review slow queries
# Cloud → Database → Performance → Top 10 slowest

# 2. Check database size and growth
# Cloud → Database → Usage

# 3. Review Sentry trends
# Are errors increasing? New patterns?

# 4. Run load tests
npm run scripts/loadtest-checkout.js

# 5. Update dependencies
npm outdated
npm update
```

### Monthly Tasks (4 hours)

```bash
# 1. Security audit
npm audit
npm audit fix

# 2. Review and update documentation
# Check if runbooks are current

# 3. Capacity planning
# Review database growth
# Check if instance size needs increase

# 4. Backup verification
# Verify backups are running
# Test restore procedure

# 5. Performance optimization
# Identify bottlenecks
# Add indexes where needed
```

---

## Deployment Procedures

### Standard Deployment

**Frontend changes**:
```bash
# 1. Code is pushed to GitHub
# 2. Changes automatically sync to Lovable
# 3. Click "Update" in Publish dialog to deploy
```

**Backend changes** (Edge functions, database):
```bash
# Edge functions: Deploy automatically on code changes
# Database migrations: Run via migration tool, require approval
```

### Rollback Procedure

**Frontend**:
```bash
# Via Lovable UI:
# 1. Version History → Select previous version → Restore
# 2. Click "Update" in Publish dialog
```

**Backend** (Edge functions):
```bash
# Via Git:
git revert HEAD
git push origin main
# Functions redeploy automatically
```

**Database** (if needed):
```bash
# Create reverse migration
# Example: If you added a column, create migration to drop it
# Run via migration tool
```

### Hotfix Process

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-issue main

# 2. Make minimal fix
# Edit only what's necessary

# 3. Test fix
npm test
npm run test:e2e

# 4. Deploy
git push origin hotfix/critical-issue
# Merge to main via GitHub

# 5. Monitor
# Watch Sentry for 30 minutes
# Check error rates return to normal
```

---

## Monitoring & Alerts

### Key Metrics to Watch

**Application Health**:
- Error rate < 1%
- P95 response time < 3s
- Uptime > 99.9%

**Business Metrics**:
- Orders per hour (track trends)
- Checkout conversion rate > 80%
- Active users (track trends)

**System Metrics**:
- CPU usage < 70%
- Memory usage < 80%
- Database connections < 80% of limit

### Alert Response Times

| Severity | Response Time | Example |
|----------|--------------|---------|
| P0 - Critical | Immediate | Site down |
| P1 - High | < 2 hours | Checkout broken |
| P2 - Medium | < 1 day | Minor feature issue |
| P3 - Low | < 1 week | UI bug |

---

## Database Operations

### Common Queries

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Find missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;

-- Active queries
SELECT 
  pid,
  now() - query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

### Backup & Restore

**Backup** (automatic):
- Daily backups via Lovable Cloud
- 30-day retention
- Point-in-time recovery available

**Manual backup**:
```bash
# Export via Lovable Cloud UI:
# Cloud → Database → Tables → Select table → Export
```

**Restore**:
```bash
# Via Lovable Cloud UI:
# Cloud → Database → Backups → Select backup → Restore
# WARNING: This will replace current data
```

---

## Security Procedures

### Security Incident Response

1. **Detect**: Via security alert or report
2. **Contain**: Disable affected accounts/features
3. **Investigate**: Check logs, Sentry, database
4. **Remediate**: Fix vulnerability
5. **Notify**: Inform affected users if needed
6. **Document**: Write post-mortem

### Common Security Tasks

```bash
# Disable compromised account
# Cloud → Authentication → Users → Select user → Disable

# Rotate secrets
# Cloud → Secrets → Select secret → Regenerate

# Review access logs
# Cloud → Authentication → Logs → Filter by user

# Check for SQL injection attempts
# Review database logs for unusual queries
```

---

## Contact & Escalation

### When to Escalate

**Escalate immediately if**:
- Site down for > 15 minutes
- Data breach suspected
- Cannot resolve issue within SLA
- Issue affects > 50% of users

### Escalation Path

1. **On-call engineer** (Slack: #engineering-oncall)
2. **Engineering manager** (if on-call unavailable)
3. **CTO/VP Engineering** (for critical issues)

### Incident Communication

```markdown
**Template for incident updates**:

🚨 INCIDENT: [Brief description]
Severity: P1
Status: Investigating / Identified / Monitoring / Resolved
Impact: [Who/what is affected]
ETA: [If known]
Updates: [Key findings or actions]

Last updated: [Timestamp]
```

Post in:
- #engineering-incidents (Slack)
- Status page (if public)
- Customer support (if customer-facing)

---

## Tools Access

### Required Access
- GitHub repository (write access)
- Lovable project (editor access)
- Sentry (admin access)
- Stripe dashboard (view access)

### Getting Access
Contact: DevOps lead or engineering manager

---

## Useful Commands

```bash
# Run full test suite
npm test && npm run test:e2e

# Check for security vulnerabilities
npm audit

# Run load tests
node scripts/loadtest-checkout.js

# Performance benchmark
node scripts/performance-benchmark.js

# Check bundle size
npm run build
du -sh dist/
```

---

## Documentation

- **Testing Guide**: `docs/TESTING-GUIDE.md`
- **Standards**: `docs/STANDARDS.md`
- **Monitoring**: `docs/MONITORING.md`
- **API Documentation**: `API.md`
- **Architecture**: `ARCHITECTURE.md`

---

**Last Updated**: 2025-01-15
**Next Review**: 2025-02-15
