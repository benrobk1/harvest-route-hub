# Edge Function Monitoring Guide

## Overview

This guide covers monitoring, observability, and debugging for Supabase Edge Functions using the middleware pattern.

## Structured Logging

All edge functions use structured JSON logging for easy parsing and aggregation.

### Log Types

1. **Request Metrics**
```json
{
  "type": "metrics",
  "timestamp": "2025-01-15T10:30:00Z",
  "requestId": "abc-123-def",
  "functionName": "checkout",
  "method": "POST",
  "path": "/checkout",
  "statusCode": 200,
  "durationMs": 245,
  "userId": "user-456",
  "metadata": {
    "markers": [
      { "name": "auth_complete", "timestamp": 45 },
      { "name": "validation_complete", "timestamp": 78 },
      { "name": "payment_complete", "timestamp": 210 }
    ]
  }
}
```

2. **Business Events**
```json
{
  "type": "business_event",
  "requestId": "abc-123-def",
  "eventType": "order_created",
  "details": {
    "orderId": "order-789",
    "totalAmount": 125.50,
    "deliveryDate": "2025-01-20"
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

3. **Security Events**
```json
{
  "type": "security_event",
  "requestId": "abc-123-def",
  "eventType": "rate_limit_exceeded",
  "userId": "user-456",
  "details": {
    "endpoint": "checkout",
    "attemptCount": 12,
    "windowMs": 900000
  },
  "timestamp": "2025-01-15T10:30:00Z"
}
```

4. **Slow Query Warnings**
```json
{
  "type": "slow_query",
  "requestId": "abc-123-def",
  "query": "SELECT * FROM orders WHERE...",
  "durationMs": 1850,
  "threshold": 1000,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Using Metrics Collector

### Basic Usage

```typescript
import { createMetricsCollector } from '../_shared/monitoring/metrics.ts';

// In your edge function
const requestId = crypto.randomUUID();
const metrics = createMetricsCollector(requestId, 'my-function');

// Track performance milestones
metrics.mark('auth_complete');
metrics.mark('validation_complete');
metrics.mark('payment_processed');

// Log complete request
metrics.log({
  method: req.method,
  path: new URL(req.url).pathname,
  statusCode: 200,
  userId: user.id,
});
```

### Performance Tracking

All edge functions now automatically track the following metrics:

#### Request Metrics
- **Duration**: Total request processing time (ms)
- **Status Code**: HTTP response status
- **Method**: HTTP method (GET, POST, etc.)
- **Path**: Request path
- **User ID**: Authenticated user (if applicable)

#### Checkpoint Markers
Functions can add custom checkpoint markers to track specific stages:

```typescript
ctx.metrics.mark('validation_complete');
ctx.metrics.mark('payment_processed');
ctx.metrics.mark('order_created');
```

#### Error Metrics
When errors occur, additional context is logged:

- **Error Message**: Human-readable error description
- **Error Stack**: Full stack trace for debugging
- **Error Type**: Classification of error

### Metrics Structure

#### Log Format
```json
{
  "requestId": "uuid-v4",
  "functionName": "checkout",
  "duration": 2341,
  "method": "POST",
  "path": "/checkout",
  "statusCode": 200,
  "userId": "user-uuid",
  "checkpoints": {
    "auth_complete": 45,
    "validation_complete": 89,
    "payment_processed": 2103,
    "order_created": 2298
  }
}
```

#### Error Log Format
```json
{
  "requestId": "uuid-v4",
  "functionName": "checkout",
  "duration": 1823,
  "method": "POST",
  "path": "/checkout",
  "statusCode": 500,
  "userId": "user-uuid",
  "errorMessage": "Payment processing failed",
  "errorStack": "Error: Payment processing failed\n    at CheckoutService...",
  "checkpoints": {
    "auth_complete": 43,
    "validation_complete": 87,
    "payment_failed": 1820
  }
}
```

### Viewing Metrics

#### Via Edge Function Logs

All metrics are logged to the edge function console and can be viewed in real-time:

1. **Lovable Cloud Dashboard**: Navigate to your edge functions
2. **Filter by Request ID**: Use the unique request ID for tracing
3. **Search Logs**: Look for structured JSON metrics

#### Log Queries

Example queries for common scenarios:

**Find slow requests (>3s)**:
```
duration>3000
```

**Find all errors for a user**:
```
userId:"user-uuid" AND statusCode>=400
```

**Track checkpoint timing**:
```
checkpoints.payment_processed>2000
```

### Performance Baselines

#### Current Performance Targets (p95)

| Function | Target | Current | Status |
|----------|--------|---------|--------|
| checkout | <2.5s | ~2.3s | ✅ |
| award-credits | <1s | ~800ms | ✅ |
| generate-batches | <10s | ~7s | ✅ |
| process-payouts | <5s | ~4.2s | ✅ |
| claim-route | <500ms | ~320ms | ✅ |
| cancel-order | <2s | ~1.8s | ✅ |

#### Checkpoint Baselines

Typical checkpoint timings for reference:

```
auth_complete: 40-60ms
validation_complete: 80-120ms
payment_processed: 1800-2200ms (Stripe API)
database_write: 100-200ms
notification_sent: 150-300ms (non-blocking)
```

## Metrics Best Practices
  
  ctx.metrics.mark('database_complete');
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
```

### Logging Business Events

```typescript
import { logBusinessEvent } from '../_shared/monitoring/metrics.ts';

// Log important business events
logBusinessEvent(ctx.requestId, 'order_created', {
  orderId: order.id,
  totalAmount: order.total_amount,
  deliveryDate: order.delivery_date,
});
```

### Logging Security Events

```typescript
import { logSecurityEvent } from '../_shared/monitoring/metrics.ts';

// Log security-related events
logSecurityEvent(ctx.requestId, 'failed_auth_attempt', userId, {
  reason: 'invalid_token',
  ipAddress: req.headers.get('x-forwarded-for'),
});
```

### Tracking Slow Queries

```typescript
import { logSlowQuery } from '../_shared/monitoring/metrics.ts';

const startTime = Date.now();
const { data, error } = await supabase.from('orders').select('*');
const duration = Date.now() - startTime;

// Automatically warns if query exceeds threshold (default 1000ms)
logSlowQuery(ctx.requestId, 'SELECT * FROM orders', duration);
```

## Performance Markers

Use performance markers to track execution time of key operations:

```typescript
const handler = withMetrics('checkout')(async (req, ctx) => {
  ctx.metrics.mark('start');
  
  // Authentication
  // ... auth logic ...
  ctx.metrics.mark('auth_complete');
  
  // Validation
  // ... validation logic ...
  ctx.metrics.mark('validation_complete');
  
  // Database operations
  // ... db operations ...
  ctx.metrics.mark('database_complete');
  
  // Payment processing
  // ... payment logic ...
  ctx.metrics.mark('payment_complete');
  
  return new Response(/* ... */);
});
```

Markers will appear in the metrics log:
```json
{
  "metadata": {
    "markers": [
      { "name": "start", "timestamp": 0 },
      { "name": "auth_complete", "timestamp": 45 },
      { "name": "validation_complete", "timestamp": 78 },
      { "name": "database_complete", "timestamp": 180 },
      { "name": "payment_complete", "timestamp": 210 }
    ]
  }
}
```

## Monitoring Best Practices

### 1. Request ID Correlation
Always use `requestId` to correlate logs for a single request:

```bash
# Filter logs by request ID
supabase functions logs checkout | grep "abc-123-def"
```

### 2. Track Critical Paths
Add performance markers for:
- Authentication
- Validation
- Database queries
- External API calls
- Payment processing

### 3. Log Business Events
Track important business metrics:
- Orders created/canceled
- Payments processed
- Payouts completed
- Batches generated

### 4. Monitor Security Events
Always log:
- Failed authentication attempts
- Rate limit violations
- Permission denials
- Invalid input attempts

### 5. Set Query Thresholds
Define acceptable query times and monitor violations:

```typescript
// Custom threshold for critical queries
logSlowQuery(ctx.requestId, query, duration, 500); // 500ms threshold
```

## Debugging Common Issues

### High Latency

1. Check performance markers to identify slow operations
2. Review slow query logs
3. Verify rate limiting isn't causing delays
4. Check external API response times

### Authentication Failures

1. Filter logs for `security_event` with `eventType: "failed_auth"`
2. Check JWT token expiration
3. Verify Supabase client configuration

### Rate Limit Exceeded

1. Review `security_event` logs for rate limit violations
2. Adjust rate limit thresholds in `constants.ts` if needed
3. Implement exponential backoff on client side

### Database Performance

1. Monitor slow query warnings
2. Add database indexes for frequently queried fields
3. Optimize query patterns (reduce N+1 queries)

## Alerting Recommendations

Set up alerts for:

1. **High Error Rate** (>5% of requests)
2. **Slow Response Time** (p95 > 2000ms)
3. **Rate Limit Exceeded** (>10 violations/minute)
4. **Authentication Failures** (>20 failures/minute)
5. **Database Slow Queries** (>100 slow queries/hour)

## Integration with External Services

### Sentry Integration

Middleware automatically sends errors to Sentry if configured:

```typescript
// Errors are automatically captured by withErrorHandling middleware
// No additional code needed
```

### Log Aggregation Tools

Structured JSON logs can be easily ingested by:
- **Datadog**: Parse JSON logs and create dashboards
- **Grafana Loki**: Query logs using LogQL
- **CloudWatch**: Stream logs and set up alarms
- **Elasticsearch**: Index logs for full-text search

### Example Datadog Query

```
type:metrics statusCode:>=500 functionName:checkout
```

### Example Loki Query

```logql
{function="checkout"} | json | statusCode >= 500
```

## Performance Targets

### Response Time
- **p50**: < 500ms
- **p95**: < 2000ms
- **p99**: < 5000ms

### Error Rate
- **Overall**: < 1%
- **4xx errors**: < 5%
- **5xx errors**: < 0.5%

### Availability
- **Uptime**: > 99.9%
- **Success Rate**: > 99%

## Related Documentation

- [MIDDLEWARE.md](../supabase/functions/MIDDLEWARE.md) - Middleware pattern reference
- [TESTING-GUIDE.md](./TESTING-GUIDE.md) - Testing strategies
- [RUNBOOK.md](./RUNBOOK.md) - Operations runbook
