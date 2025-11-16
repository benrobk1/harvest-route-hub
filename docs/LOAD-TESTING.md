# Load Testing Guide

This guide explains how to run load tests on edge functions to benchmark performance under various traffic patterns.

## Overview

Load testing helps identify:
- **Performance bottlenecks** under high load
- **Breaking points** where the system fails
- **Memory leaks** during extended operation
- **Scalability limits** for capacity planning

## Test Patterns

### 1. Sustained Load Test
Simulates constant traffic to establish baseline performance.

```bash
node scripts/loadtest-edge-functions.js \
  --pattern=sustained \
  --function=checkout \
  --maxvus=50 \
  --duration=120
```

**Use case**: Daily operations, baseline metrics

### 2. Spike Test
Simulates sudden traffic spikes (e.g., product launches, sales).

```bash
node scripts/loadtest-edge-functions.js \
  --pattern=spike \
  --function=checkout \
  --maxvus=200 \
  --duration=180
```

**Use case**: Marketing campaigns, viral events

### 3. Stress Test
Gradually increases load until system breaks.

```bash
node scripts/loadtest-edge-functions.js \
  --pattern=stress \
  --function=generate-batches \
  --maxvus=500 \
  --duration=300
```

**Use case**: Capacity planning, identifying limits

### 4. Soak Test
Extended duration test for memory leaks and resource exhaustion.

```bash
node scripts/loadtest-edge-functions.js \
  --pattern=soak \
  --function=checkout \
  --maxvus=20 \
  --duration=1800
```

**Use case**: Stability testing, memory leak detection

## Artillery Load Testing

For more advanced scenarios, use Artillery:

### Installation

```bash
npm install -g artillery
```

### Run Tests

```bash
# Basic sustained load
artillery run scripts/artillery-config.yml

# Spike test
artillery run -e spike scripts/artillery-config.yml

# Stress test
artillery run -e stress scripts/artillery-config.yml

# Soak test (30 minutes)
artillery run -e soak scripts/artillery-config.yml
```

### Generate HTML Report

```bash
artillery run --output report.json scripts/artillery-config.yml
artillery report report.json
```

## Test Functions

Available functions for testing:

| Function | Purpose | Recommended VUs | Notes |
|----------|---------|-----------------|-------|
| `checkout` | Payment processing | 50-100 | External Stripe API |
| `check-subscription` | Subscription status | 100-200 | Cached, fast |
| `generate-batches` | Route optimization | 10-20 | CPU intensive |
| `get-metrics` | Monitoring dashboard | 50-100 | Admin only |
| `award-credits` | Credit management | 20-50 | Database writes |

## Interpreting Results

### Key Metrics

```
📊 LOAD TEST RESULTS
═══════════════════════════════════════════════════════════
Total Requests: 1250
✅ Successful: 1245 (99.60%)
❌ Failed: 5 (0.40%)
───────────────────────────────────────────────────────────
Throughput: 10.42 req/s
Error Rate: 0.04 errors/s
───────────────────────────────────────────────────────────
Avg Duration: 847ms
P50: 723ms
P95: 1842ms
P99: 2156ms
Min: 234ms
Max: 3421ms
═══════════════════════════════════════════════════════════
```

### Performance Targets

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| Success Rate | >99% | 95-99% | <95% |
| P95 Duration | <1s | 1-2s | >2s |
| Error Rate | <0.1% | 0.1-1% | >1% |
| Throughput | >20 req/s | 10-20 req/s | <10 req/s |

### Red Flags

⚠️ **High Error Rate** (>5%)
- Check error logs for patterns
- Verify database connection limits
- Check rate limiting configuration

⚠️ **Increasing Response Times**
- Memory leak suspected
- Database query optimization needed
- Consider scaling resources

⚠️ **Throughput Degradation**
- Cold start issues
- Connection pool exhaustion
- Rate limiting triggered

## Optimization Strategies

### 1. Caching

```typescript
// Before: No caching
const marketConfig = await supabase
  .from('market_configs')
  .select('*')
  .eq('zip_code', zipCode)
  .single();

// After: With caching (100-200x faster)
const cached = marketConfigCache.get(zipCode);
if (cached) return cached;

const marketConfig = await supabase
  .from('market_configs')
  .select('*')
  .eq('zip_code', zipCode)
  .single();

marketConfigCache.set(zipCode, marketConfig, 600);
```

**Impact**: P95 reduced from 1200ms → 50ms

### 2. Query Parallelization

```typescript
// Before: Sequential (slower)
const cart = await validateCart(cartId, userId);
const cartItems = await getCartItems(cartId);
const profile = await getUserProfile(userId);
// Total: ~400ms

// After: Parallel (faster)
const [cart, cartItems, profile] = await Promise.all([
  validateCart(cartId, userId),
  getCartItems(cartId),
  getUserProfile(userId)
]);
// Total: ~120ms (3.3x faster)
```

**Impact**: P95 reduced from 2500ms → 800ms

### 3. Batch Processing

```typescript
// Before: Sequential processing
for (const payout of payouts) {
  await processIndividualPayout(payout);
}
// 100 payouts = ~30 seconds

// After: Batched (10 at a time)
const batches = chunkArray(payouts, 10);
for (const batch of batches) {
  await Promise.all(batch.map(processIndividualPayout));
}
// 100 payouts = ~5 seconds (6x faster)
```

**Impact**: P95 reduced from 30s → 5s

## Load Testing Best Practices

### 1. Start Small
```bash
# ✅ GOOD: Gradual ramp-up
--maxvus=10 --duration=60   # Warm-up
--maxvus=50 --duration=120  # Baseline
--maxvus=100 --duration=180 # Stress

# ❌ BAD: Immediate overload
--maxvus=500 --duration=600
```

### 2. Use Realistic Data
```typescript
// ✅ GOOD: Varied test data
const payload = {
  cartId: `cart-${Math.random()}`,
  deliveryDate: generateRandomDate(),
  tipAmount: Math.random() * 10
};

// ❌ BAD: Same data every time
const payload = {
  cartId: 'test-cart-1',
  deliveryDate: '2024-01-01',
  tipAmount: 5.00
};
```

### 3. Monitor System Resources
```bash
# Watch CPU, memory, connections
top -bn 1 | grep "Cpu\|Mem"

# Check database connections
SELECT count(*) FROM pg_stat_activity;

# Monitor edge function logs
supabase functions logs --function=checkout
```

### 4. Clean Up After Tests
```bash
# Remove test data
DELETE FROM orders WHERE consumer_id = 'loadtest-user-id';
DELETE FROM webhook_logs WHERE created_at < now() - interval '1 hour';

# Reset rate limiters
DELETE FROM rate_limits;
```

## Continuous Load Testing

### GitHub Actions Integration

Create `.github/workflows/loadtest.yml`:

```yaml
name: Weekly Load Test

on:
  schedule:
    - cron: '0 2 * * 0' # Every Sunday at 2 AM
  workflow_dispatch:

jobs:
  loadtest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run load test
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
        run: |
          node scripts/loadtest-edge-functions.js \
            --pattern=sustained \
            --function=checkout \
            --maxvus=50 \
            --duration=120
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: loadtest-results
          path: loadtest-*.json
```

## Troubleshooting

### High Failure Rate

**Symptoms**: >5% error rate

**Causes**:
- Rate limiting triggered
- Database connection pool exhausted
- Authentication token expired
- External API timeouts (Stripe, OSRM)

**Solutions**:
```bash
# Check rate limit configuration
# Increase connection pool size
# Use service role key for testing
# Add retry logic with exponential backoff
```

### Memory Issues

**Symptoms**: Increasing response times over extended tests

**Causes**:
- Memory leaks in edge functions
- Cache growing unbounded
- Connection leaks

**Solutions**:
```typescript
// Implement cache cleanup
cache.cleanup(); // Remove expired entries

// Close connections properly
await supabase.auth.signOut();

// Monitor memory usage
console.log(`Memory: ${process.memoryUsage().heapUsed / 1024 / 1024} MB`);
```

### Timeout Errors

**Symptoms**: Requests timing out after 30s

**Causes**:
- Slow database queries
- External API delays
- Large payload processing

**Solutions**:
```typescript
// Add query timeouts
const { data, error } = await supabase
  .from('table')
  .select()
  .abortSignal(AbortSignal.timeout(5000)); // 5s timeout

// Implement circuit breaker
if (consecutiveFailures > 5) {
  throw new Error('Circuit breaker open');
}
```

## Load Test Checklist

Before running production load tests:

- [ ] Set up test user accounts
- [ ] Configure rate limits appropriately
- [ ] Enable demo mode to skip external APIs
- [ ] Monitor system resources (CPU, memory, connections)
- [ ] Set up alerting for anomalies
- [ ] Schedule during low-traffic periods
- [ ] Have rollback plan ready
- [ ] Notify team members
- [ ] Clean up test data afterwards
- [ ] Document results and findings

## Example Results Analysis

### Good Performance

```
Function: checkout
Pattern: sustained
VUs: 50, Duration: 120s

Total Requests: 6000
Success Rate: 99.8%
P95: 850ms
P99: 1200ms
Throughput: 50 req/s

✅ System healthy, can handle sustained load
```

### Needs Optimization

```
Function: generate-batches
Pattern: stress
VUs: 100, Duration: 300s

Total Requests: 5000
Success Rate: 92.3%
P95: 5200ms
P99: 8900ms
Throughput: 16.7 req/s

⚠️ High P95/P99, error rate >5%
Action: Optimize OSRM calls, add caching
```

### Critical Issues

```
Function: process-payouts
Pattern: spike
VUs: 200, Duration: 180s

Total Requests: 1200
Success Rate: 67.5%
P95: 12000ms
P99: 25000ms
Throughput: 6.7 req/s

🚨 CRITICAL: High failure rate, very slow
Action: Immediate investigation required
- Check database locks
- Verify Stripe API health
- Review connection pooling
```

## Summary

Load testing is essential for:
- **Validating** system performance under realistic conditions
- **Identifying** bottlenecks before they impact users
- **Planning** capacity for growth
- **Preventing** outages during traffic spikes

Run load tests regularly (weekly recommended) and after major changes to ensure system reliability.
