# Monitoring & Observability Guide

## Overview

This guide covers monitoring, logging, error tracking, and performance observability for the Blue Harvests platform.

## Error Tracking (Sentry)

### Production Setup (CRITICAL)

**⚠️ IMPORTANT:** Sentry is disabled by default. You MUST configure it for production monitoring.

**Setup Steps:**
1. Create a free account at [https://sentry.io/](https://sentry.io/)
2. Create a new project (select "React")
3. Copy your DSN from the project settings
4. Add `VITE_SENTRY_DSN` to your production environment variables
5. Deploy your application

**Validation:**
- Development: Console will show warning if DSN not set
- Production: Error banner will appear if DSN not set + console error logged

Without Sentry configured in production:
- ❌ No error tracking
- ❌ No incident alerts
- ❌ No performance monitoring
- ❌ No user feedback collection

### Local Development Setup

Sentry is configured in `src/lib/sentry.ts` for comprehensive error tracking.

```typescript
import { initSentry, setSentryUser, captureException } from '@/lib/sentry';

// Initialize on app start (already done in main.tsx)
initSentry();

// Set user context after authentication
setSentryUser({
  id: user.id,
  email: user.email,
  role: user.role
});

// Manually capture exceptions
try {
  await riskyOperation();
} catch (error) {
  captureException(error);
  throw error;
}
```

### Environment Variables

**Development (.env):**
```env
# Optional in development - logs warning if not set
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

**Production (hosting platform environment variables):**
```env
# REQUIRED for production monitoring
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

**Verification:**
- Run the app and check the browser console
- Development: Should see "⚠️ Sentry DSN not configured" warning
- Production: Should see "❌ CRITICAL: Sentry DSN not configured" error + banner
- With DSN set: Should see "✅ Initializing Sentry error tracking..."

### What Sentry Captures

#### Automatic Tracking
- **Unhandled exceptions**: JavaScript errors that aren't caught
- **Unhandled promise rejections**: Async errors
- **React error boundaries**: Component rendering errors
- **Network errors**: Failed API calls
- **Performance traces**: Page load times, API response times

#### Manual Tracking
```typescript
import { captureMessage, captureException, addBreadcrumb } from '@/lib/sentry';

// Log important events
captureMessage('Order submitted successfully', 'info');

// Track errors with context
try {
  await processPayment(amount);
} catch (error) {
  captureException(error, {
    tags: { 
      payment_processor: 'stripe',
      amount: amount 
    },
    level: 'error'
  });
}

// Add breadcrumbs for debugging
addBreadcrumb({
  category: 'cart',
  message: 'Item added to cart',
  level: 'info',
  data: { productId, quantity }
});
```

### Sentry Dashboard

Access your Sentry dashboard at `https://sentry.io/organizations/your-org/projects/`:

**Key Sections**:
- **Issues**: Grouped errors with frequency and impact
- **Performance**: Transaction traces and slow operations
- **Releases**: Track errors by deployment version
- **Alerts**: Configure notifications for critical errors

### Best Practices

1. **Set Context**: Always include relevant context with errors
```typescript
Sentry.setContext('order', {
  orderId: order.id,
  total: order.total,
  itemCount: order.items.length
});
```

2. **Use Tags**: Tag errors for easier filtering
```typescript
Sentry.setTag('feature', 'checkout');
Sentry.setTag('user_role', userRole);
```

3. **Configure Sample Rates**: Adjust in `sentry.ts`
```typescript
tracesSampleRate: 1.0, // 100% in development
replaysSessionSampleRate: 0.1, // 10% of sessions
replaysOnErrorSampleRate: 1.0, // 100% when errors occur
```

4. **Filter Sensitive Data**: Sentry masks all text and media by default
```typescript
Sentry.replayIntegration({
  maskAllText: true,
  blockAllMedia: true,
})
```

## Application Logging

### Edge Function Logging

Edge functions log to Supabase's logging system:

```typescript
// Structured logging with request ID
console.log(`[${requestId}] Processing checkout`, {
  userId,
  itemCount,
  total
});

console.error(`[${requestId}] Checkout failed`, {
  error: error.message,
  userId
});
```

### Viewing Edge Function Logs

**Via Supabase Dashboard**:
1. Navigate to Edge Functions
2. Select function
3. View logs tab

**Via CLI**:
```bash
supabase functions logs checkout --project-ref your-project-ref
```

### Log Levels

Use consistent log levels:

```typescript
// INFO: General information
console.log('[INFO] Order created', { orderId });

// WARN: Potential issues
console.warn('[WARN] Low inventory', { productId, available: 2 });

// ERROR: Errors that need attention
console.error('[ERROR] Payment failed', { error, orderId });
```

### Request ID Tracking

All edge functions use `withRequestId` middleware for correlated logging:

```typescript
import { withRequestId } from './_shared/middleware/withRequestId';

const handler = withRequestId(async (req, ctx) => {
  // ctx.requestId is available
  console.log(`[${ctx.requestId}] Processing request`);
});
```

This generates logs like:
```
[abc-123] [CHECKOUT] Request started: POST /checkout
[abc-123] Processing checkout for user xyz-456
[abc-123] [CHECKOUT] Request completed: 200 (245ms)
```

## Performance Monitoring

### Frontend Performance

#### Web Vitals Tracking

```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

function sendToAnalytics({ name, delta, id }) {
  // Send to your analytics endpoint
  console.log({ metric: name, value: delta, id });
}

getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
```

#### React Query Performance

Monitor query performance:
```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      onError: (error) => {
        console.error('Query error:', error);
        captureException(error);
      },
      onSuccess: (data, query) => {
        const duration = Date.now() - query.state.dataUpdatedAt;
        if (duration > 1000) {
          console.warn('Slow query detected', {
            queryKey: query.queryKey,
            duration
          });
        }
      }
    }
  }
});
```

### Backend Performance

#### Edge Function Metrics

Track execution time:
```typescript
const startTime = Date.now();
// ... operation
const duration = Date.now() - startTime;

if (duration > 1000) {
  console.warn('Slow operation', { operation: 'checkout', duration });
}
```

#### Database Query Performance

Monitor slow queries via Supabase:
1. Dashboard → Database → Query Performance
2. Look for queries with high execution time
3. Add indexes for frequently filtered columns

### Load Testing

Run performance tests regularly:

```bash
# Batch generation load test
node scripts/loadtest-batches.js

# Checkout flow load test
node scripts/loadtest-checkout.js

# Comprehensive benchmarks
node scripts/performance-benchmark.js
```

**Performance Targets**:
- Simple queries: < 100ms
- Complex queries: < 500ms
- Edge functions: < 1s (95th percentile)
- Page load: < 2s

## Health Checks

### Application Health

Create health check endpoints:

```typescript
// supabase/functions/health/index.ts
Deno.serve(async () => {
  try {
    // Check database connectivity
    const { error } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({ status: 'healthy', timestamp: Date.now() }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'unhealthy', error: error.message }),
      { status: 503 }
    );
  }
});
```

### Monitoring Checklist

Run this checklist weekly:

- [ ] Review Sentry error rates
- [ ] Check for new error patterns
- [ ] Review slow query logs
- [ ] Check edge function performance
- [ ] Verify health check endpoints
- [ ] Review application metrics
- [ ] Check disk/memory usage
- [ ] Verify backup status

## Alerts & Notifications

### Sentry Alerts

Configure alerts in Sentry dashboard:

1. **Critical Errors**: > 10 occurrences in 5 minutes
2. **Error Rate**: > 5% of requests failing
3. **Slow Transactions**: P95 > 3 seconds
4. **New Issues**: First occurrence of new error

### Database Alerts

Monitor via Supabase:
- High CPU usage (> 80%)
- High memory usage (> 80%)
- Slow queries (> 1s)
- High error rate

### Custom Alerts

Implement custom alerts:

```typescript
// Alert on critical errors
if (errorRate > 0.05) {
  await sendAlert({
    severity: 'critical',
    message: `Error rate exceeded 5%: ${errorRate * 100}%`,
    context: { errorCount, totalRequests }
  });
}

// Alert on performance degradation
if (p95ResponseTime > 3000) {
  await sendAlert({
    severity: 'warning',
    message: `P95 response time: ${p95ResponseTime}ms`,
    context: { endpoint, timeWindow: '5m' }
  });
}
```

## Incident Response

### Response Process

1. **Detect**: Via alerts or user reports
2. **Triage**: Assess severity and impact
3. **Investigate**: Check logs, metrics, errors
4. **Mitigate**: Quick fix or rollback
5. **Resolve**: Permanent fix
6. **Post-Mortem**: Document and improve

### Severity Levels

**Critical (P0)**:
- Site down for all users
- Data loss or corruption
- Security breach
- Response: Immediate, 24/7

**High (P1)**:
- Major feature broken
- Affecting > 50% of users
- Performance severely degraded
- Response: Within 2 hours

**Medium (P2)**:
- Minor feature broken
- Affecting < 50% of users
- Workaround available
- Response: Within 1 business day

**Low (P3)**:
- Minor bug or inconvenience
- No impact on core functionality
- Response: Within 1 week

### Incident Log Template

```markdown
# Incident Report: [Brief Description]

**Date**: 2025-01-15
**Severity**: P1
**Duration**: 45 minutes
**Impact**: Checkout unavailable for all users

## Timeline
- 14:00: Alert triggered - high error rate on checkout
- 14:05: Investigation started
- 14:15: Root cause identified - Stripe API timeout
- 14:20: Temporary fix deployed - increased timeout
- 14:45: Issue resolved - Stripe connectivity restored

## Root Cause
Stripe API experienced degraded performance affecting all checkout requests.

## Resolution
- Increased request timeout from 10s to 30s
- Added retry logic for failed Stripe requests
- Improved error messaging for users

## Prevention
- [ ] Add circuit breaker for external API calls
- [ ] Implement queue system for checkout
- [ ] Set up status page monitoring Stripe health
```

## Maintenance Procedures

### Daily Checks
```bash
# Check application health
curl https://your-app.com/health

# Review overnight errors in Sentry
# Check edge function logs for errors
# Verify scheduled jobs ran successfully
```

### Weekly Tasks
- Review Sentry issues and trends
- Analyze slow query logs
- Check database performance metrics
- Review and update dependencies
- Run load tests
- Verify backup integrity

### Monthly Tasks
- Comprehensive security audit
- Performance optimization review
- Capacity planning review
- Update documentation
- Review and update alerts
- Disaster recovery drill

### Quarterly Tasks
- Major dependency updates
- Architecture review
- Incident retrospective
- Update runbooks
- Team training on new tools

## Dashboards

### Recommended Dashboards

**Operations Dashboard**:
- Request rate (rpm)
- Error rate (%)
- P50/P95/P99 latency
- Active users
- Edge function health

**Business Dashboard**:
- Orders per hour
- Revenue per hour
- User signups
- Cart abandonment rate
- Popular products

**Engineering Dashboard**:
- Deployment frequency
- Mean time to recovery
- Test coverage
- Build times
- Code churn

## Tools & Resources

### Monitoring Stack
- **Error Tracking**: Sentry
- **Logging**: Supabase Logs
- **Metrics**: Custom implementation
- **Uptime**: Uptime Robot or Pingdom
- **APM**: Sentry Performance

### Useful Queries

```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check database connections
SELECT count(*) FROM pg_stat_activity;

-- Table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Documentation
- [Sentry Documentation](https://docs.sentry.io/)
- [Supabase Logging](https://supabase.com/docs/guides/platform/logs)
- [Web Vitals](https://web.dev/vitals/)

## Support

For monitoring issues:
1. Check this guide
2. Review Sentry and Supabase dashboards
3. Consult incident logs
4. Escalate to engineering team
