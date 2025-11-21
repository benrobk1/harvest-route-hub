# Scaling Blue Harvests to 100,000 Concurrent Users

**Date:** November 21, 2025
**Current Capacity:** ~100 concurrent users
**Target Capacity:** 100,000 concurrent users (1000x scale)
**Estimated Timeline:** 12-18 months
**Estimated Cost:** $50K-$150K/month infrastructure

---

## Executive Summary

Blue Harvests is currently architected for ~100 concurrent users. Scaling to 100,000 requires fundamental infrastructure and architectural changes. The system will fail at ~1,000 users due to database connection exhaustion, and at ~30,000 users due to rate limiting table write amplification.

**Critical Path:** Database scaling → Caching layer → Async processing → Geographic distribution

**Total Investment Required:**
- **Infrastructure:** $50K-$150K/month
- **Engineering:** 12-18 months (4-6 engineers)
- **Migration Risk:** Medium (gradual rollout possible)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Scaling Phases](#2-scaling-phases)
3. [Phase 1: Foundation (100 → 1,000 users)](#3-phase-1-foundation)
4. [Phase 2: Horizontal Scaling (1K → 10K users)](#4-phase-2-horizontal-scaling)
5. [Phase 3: Geographic Distribution (10K → 50K users)](#5-phase-3-geographic-distribution)
6. [Phase 4: Enterprise Scale (50K → 100K users)](#6-phase-4-enterprise-scale)
7. [Infrastructure Cost Breakdown](#7-infrastructure-cost-breakdown)
8. [Implementation Timeline](#8-implementation-timeline)
9. [Risk Mitigation](#9-risk-mitigation)

---

## 1. Current State Analysis

### 1.1 Bottleneck Summary

| Component | Current Limit | Failure Point | Impact | Priority |
|-----------|---------------|---------------|--------|----------|
| Database connections | 15 | ~1K users | Total outage | 🔴 P0 |
| Rate limit table writes | ~10K writes/sec | ~30K users | API lockout | 🔴 P0 |
| Stripe API calls | 100 req/sec | ~10K checkouts | Payment failures | 🟠 P1 |
| No CDN | Origin bandwidth | ~50K page loads | Slow loading | 🟡 P2 |
| WebSocket connections | ~10K | ~10K active users | Realtime breaks | 🟡 P2 |
| Sequential batch gen | Single region | ~500 orders | Delivery delays | 🟡 P2 |

### 1.2 Current Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Supabase Edge Fns  │ (15 DB connections)
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  PostgreSQL (1x)    │ (No replicas, no pooling)
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│  Stripe/Mapbox/OSRM │ (External APIs)
└─────────────────────┘
```

**Single Points of Failure:**
- ❌ Single Supabase instance (no failover)
- ❌ No read replicas
- ❌ No caching layer (Redis)
- ❌ No CDN
- ❌ No message queue
- ❌ Single region deployment

---

## 2. Scaling Phases

### Phase Overview

| Phase | Users | Timeline | Cost/Month | Key Milestone |
|-------|-------|----------|------------|---------------|
| **Phase 0** | 100 | Current | $500 | Baseline |
| **Phase 1** | 1,000 | 3 months | $5K | Connection pooling + Redis |
| **Phase 2** | 10,000 | 6 months | $20K | Read replicas + async jobs |
| **Phase 3** | 50,000 | 12 months | $75K | Multi-region + CDN |
| **Phase 4** | 100,000 | 18 months | $150K | Microservices + sharding |

---

## 3. Phase 1: Foundation (100 → 1,000 Users)

**Timeline:** Months 1-3
**Cost:** $5,000/month
**Priority:** CRITICAL - System will fail at 1K users without these changes

### 3.1 Database Connection Pooling

**Problem:** 15 connection limit exhausted at ~1K users

**Solution:** Deploy PgBouncer connection pooler

```yaml
# Infrastructure as Code (Terraform)
resource "aws_rds_proxy" "main" {
  name           = "blueharvests-pgbouncer"
  engine_family  = "POSTGRESQL"

  # Connection pool configuration
  pool_config {
    max_connections             = 1000   # Up from 15
    max_idle_connections        = 100
    connection_borrow_timeout   = 120
  }
}
```

**Implementation Steps:**
1. Deploy PgBouncer on AWS RDS Proxy ($40/month)
2. Configure Supabase to route through proxy
3. Update connection strings in edge functions
4. Test failover scenarios
5. Monitor connection metrics

**Success Metrics:**
- ✅ Support 1,000+ concurrent connections
- ✅ <50ms connection acquisition latency
- ✅ Zero connection errors under load

**Cost:** $40/month (RDS Proxy)

### 3.2 Replace Database-Backed Rate Limiting

**Problem:** 3 database operations per API request = 3M writes/minute at scale

**Solution:** Redis-backed rate limiting

```typescript
// NEW: supabase/functions/_shared/rateLimiter.redis.ts
import { Redis } from 'https://esm.sh/@upstash/redis@1.28.0';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL'),
  token: Deno.env.get('UPSTASH_REDIS_TOKEN'),
});

export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `${config.keyPrefix}:${userId}`;
  const now = Date.now();

  // Use Redis sorted set for time-based rate limiting
  const pipe = redis.pipeline();

  // Remove old entries
  pipe.zremrangebyscore(key, 0, now - config.windowMs);

  // Count current requests
  pipe.zcard(key);

  // Add current request
  pipe.zadd(key, { score: now, member: `${now}:${crypto.randomUUID()}` });

  // Set expiry
  pipe.expire(key, Math.ceil(config.windowMs / 1000));

  const results = await pipe.exec();
  const requestCount = results[1] as number;

  if (requestCount >= config.maxRequests) {
    return { allowed: false, retryAfter: Math.ceil(config.windowMs / 1000) };
  }

  return { allowed: true };
}
```

**Migration Strategy:**
1. Deploy Upstash Redis (Serverless) - $10/month
2. Run dual-write (both DB and Redis) for 1 week
3. Verify parity in logs
4. Switch reads to Redis
5. Remove DB rate limiting after 1 week
6. Drop `rate_limits` table

**Success Metrics:**
- ✅ <5ms rate limit check latency (vs 50ms database)
- ✅ Zero database writes for rate limiting
- ✅ Support 10K requests/second rate limit checks

**Cost:** $10/month (Upstash Redis Serverless)

### 3.3 Add Critical Database Indexes

**Problem:** Missing indexes cause full table scans under load

**Solution:** Add composite indexes for hot queries

```sql
-- NEW: supabase/migrations/20251121000000_add_scaling_indexes.sql

-- Orders batch assignment query (used in generate-batches)
CREATE INDEX CONCURRENTLY idx_orders_batch_assignment
ON orders(status, delivery_date, delivery_batch_id)
WHERE delivery_batch_id IS NULL;

-- Credits ledger balance calculation
CREATE INDEX CONCURRENTLY idx_credits_ledger_balance
ON credits_ledger(consumer_id, created_at DESC, transaction_type)
INCLUDE (balance_after);

-- Order items detail query (used in checkout)
CREATE INDEX CONCURRENTLY idx_order_items_order_product
ON order_items(order_id, product_id)
INCLUDE (quantity, unit_price, subtotal);

-- Batch stops driver route query
CREATE INDEX CONCURRENTLY idx_batch_stops_driver_route
ON batch_stops(delivery_batch_id, sequence_number, status)
INCLUDE (address, estimated_arrival);

-- Rate limits cleanup (until migrated to Redis)
CREATE INDEX CONCURRENTLY idx_rate_limits_cleanup
ON rate_limits(key, created_at)
WHERE created_at > NOW() - INTERVAL '1 hour';
```

**Implementation:**
- Use `CREATE INDEX CONCURRENTLY` to avoid locking tables
- Run during low-traffic hours
- Monitor index usage with `pg_stat_user_indexes`

**Success Metrics:**
- ✅ >95% index hit ratio
- ✅ <100ms query times for all hot paths
- ✅ Zero full table scans on critical tables

**Cost:** $0 (just migration)

### 3.4 Implement CDN for Static Assets

**Problem:** All assets served from origin (Supabase Storage)

**Solution:** CloudFlare CDN with edge caching

```typescript
// NEW: src/config/cdn.ts
export const CDN_CONFIG = {
  images: {
    baseUrl: process.env.VITE_CDN_URL || 'https://cdn.blueharvests.com',
    transformations: {
      thumbnail: 'w=300,h=300,fit=cover',
      medium: 'w=800,h=800,fit=contain',
      large: 'w=1600,h=1600,fit=contain',
    },
  },
};

// Usage in components:
export function ProductImage({ url, size = 'medium' }: Props) {
  const cdnUrl = `${CDN_CONFIG.images.baseUrl}/${url}?${CDN_CONFIG.images.transformations[size]}`;
  return <img src={cdnUrl} loading="lazy" />;
}
```

**CloudFlare Configuration:**
```yaml
# cloudflare-workers.toml
name = "blueharvests-cdn"
route = "cdn.blueharvests.com/*"

[vars]
CACHE_TTL = 86400  # 24 hours for images
MAX_AGE = 31536000 # 1 year for versioned assets
```

**Implementation Steps:**
1. Sign up for CloudFlare (Free tier)
2. Configure DNS to point cdn.blueharvests.com to CloudFlare
3. Set up cache rules (24hr for images, 1 year for CSS/JS)
4. Update all image URLs in components
5. Purge cache on content updates

**Success Metrics:**
- ✅ >90% cache hit ratio
- ✅ <100ms TTFB for images globally
- ✅ 50% reduction in origin bandwidth

**Cost:** $0 (CloudFlare Free tier sufficient for Phase 1)

### 3.5 Paginate Product Listings

**Problem:** Loading all products causes slow page loads and database strain

**Solution:** Implement cursor-based pagination

```typescript
// UPDATED: src/features/products/hooks/useShopProducts.ts
export function useShopProducts(cursor?: string, limit = 50) {
  return useInfiniteQuery({
    queryKey: productQueries.shopList(),
    queryFn: ({ pageParam }) =>
      productRepo.getShopProducts({
        cursor: pageParam,
        limit
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: cursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// UPDATED: src/repositories/productRepository.ts
async getShopProducts({ cursor, limit = 50 }: PaginationParams) {
  let query = this.supabase
    .from('products')
    .select('*')
    .eq('is_available', true)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // Fetch one extra to determine if there's a next page

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) throw error;

  const hasMore = data.length > limit;
  const products = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? products[products.length - 1].created_at : null;

  return { products, nextCursor, hasMore };
}
```

**UI Updates:**
- Replace "Load All" with infinite scroll
- Add loading skeleton for better UX
- Show product count (e.g., "Showing 50 of 500")

**Success Metrics:**
- ✅ Initial page load <500ms
- ✅ <50KB data transfer for first page
- ✅ Zero out-of-memory errors on large catalogs

**Cost:** $0 (code changes only)

### Phase 1 Summary

| Item | Implementation Time | Cost/Month | Risk |
|------|---------------------|------------|------|
| PgBouncer connection pooling | 1 week | $40 | Low |
| Redis rate limiting | 2 weeks | $10 | Medium |
| Database indexes | 1 day | $0 | Low |
| CDN setup | 1 week | $0 | Low |
| Pagination | 1 week | $0 | Low |
| **TOTAL** | **6 weeks** | **$50** | **Low** |

**Success Criteria:**
- ✅ Handle 1,000 concurrent users
- ✅ P95 latency <2 seconds
- ✅ Zero database connection errors
- ✅ <$5K monthly infrastructure cost

---

## 4. Phase 2: Horizontal Scaling (1K → 10K Users)

**Timeline:** Months 4-6
**Cost:** $20,000/month
**Prerequisites:** Phase 1 complete

### 4.1 Read Replicas for Database

**Problem:** Read queries compete with writes for database resources

**Solution:** Add 2 read replicas with read/write splitting

**Architecture:**
```
┌─────────────┐
│  Primary DB │ ◄──── All writes
└──────┬──────┘
       │ (replication)
       ├────────────┬────────────┐
       ▼            ▼            ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Read #1 │   │ Read #2 │   │ Read #3 │  ◄──── All reads
└─────────┘   └─────────┘   └─────────┘
```

**Implementation with Supabase:**
```typescript
// NEW: supabase/functions/_shared/database.ts
import { createClient } from '@supabase/supabase-js';

// Write connection (primary)
export const supabaseWrite = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Read connection (replica)
export const supabaseRead = createClient(
  Deno.env.get('SUPABASE_READ_REPLICA_URL')!,  // New replica endpoint
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Smart client that routes queries
export function getSupabaseClient(operation: 'read' | 'write') {
  return operation === 'write' ? supabaseWrite : supabaseRead;
}

// Usage example:
const db = getSupabaseClient('read');
const { data } = await db.from('products').select('*');
```

**Query Classification:**
- ✅ **Reads:** Product listings, user profiles, order history, analytics
- ❌ **Writes:** Checkout, cart updates, order creation, payments
- ⚠️ **Read-after-write:** Use primary for 5 seconds after write

**Success Metrics:**
- ✅ 70-80% queries go to replicas
- ✅ Primary DB CPU <50% (down from 90%)
- ✅ Replica lag <500ms

**Cost:** $400/month (2× read replicas on Supabase Pro)

### 4.2 Redis Caching Layer

**Problem:** Expensive queries repeated constantly (products, market configs)

**Solution:** Implement comprehensive Redis caching

```typescript
// NEW: supabase/functions/_shared/cache.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: Deno.env.get('UPSTASH_REDIS_URL'),
  token: Deno.env.get('UPSTASH_REDIS_TOKEN'),
});

interface CacheConfig {
  key: string;
  ttl: number;  // seconds
}

export class CacheService {
  // Generic cache wrapper
  async cached<T>(
    config: CacheConfig,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = await redis.get<T>(config.key);
    if (cached) {
      console.log(`[CACHE HIT] ${config.key}`);
      return cached;
    }

    // Cache miss - fetch from database
    console.log(`[CACHE MISS] ${config.key}`);
    const data = await fetchFn();

    // Store in cache
    await redis.setex(config.key, config.ttl, JSON.stringify(data));

    return data;
  }

  // Invalidate cache
  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

// Usage in CheckoutService:
private async getMarketConfig(zipCode: string): Promise<MarketConfig> {
  return cacheService.cached(
    { key: `market:${zipCode}`, ttl: 600 },  // 10 minutes
    () => this.supabase
      .from('market_configs')
      .select('*')
      .eq('zip_code', zipCode)
      .single()
  );
}
```

**Cache Invalidation Strategy:**
```typescript
// Invalidate on updates
await supabase.from('market_configs').update({ ... });
await cacheService.invalidate('market:*');

// Invalidate on product updates
await supabase.from('products').update({ ... });
await cacheService.invalidate(`product:${productId}`);
```

**Cache Keys to Implement:**
| Data | Cache Key | TTL | Hit Rate |
|------|-----------|-----|----------|
| Market configs | `market:{zip}` | 10 min | 95% |
| Products | `product:{id}` | 5 min | 90% |
| Product list | `products:available` | 2 min | 85% |
| User profiles | `profile:{id}` | 10 min | 70% |
| Stripe customers | `stripe:customer:{email}` | 1 hour | 60% |
| Farm profiles | `farm:{id}` | 10 min | 80% |

**Success Metrics:**
- ✅ 80% cache hit rate
- ✅ <5ms cache response time
- ✅ 50% reduction in database queries

**Cost:** $100/month (Upstash Redis Pro - 10GB)

### 4.3 Async Job Queue

**Problem:** Long-running operations (batch generation, payouts) block API responses

**Solution:** Implement BullMQ job queue with Redis backend

```typescript
// NEW: supabase/functions/_shared/queue.ts
import { Queue, Worker } from 'bullmq';

const connection = {
  host: Deno.env.get('REDIS_HOST'),
  port: 6379,
};

// Define job queues
export const queues = {
  batchGeneration: new Queue('batch-generation', { connection }),
  payouts: new Queue('payouts', { connection }),
  notifications: new Queue('notifications', { connection }),
};

// Batch generation worker
const batchWorker = new Worker(
  'batch-generation',
  async (job) => {
    const { deliveryDate, zipCodes } = job.data;

    console.log(`[WORKER] Generating batches for ${deliveryDate}`);

    // Run batch generation asynchronously
    const result = await generateBatches(deliveryDate, zipCodes);

    return result;
  },
  {
    connection,
    concurrency: 5,  // Process 5 batches in parallel
  }
);

// Payout processing worker
const payoutWorker = new Worker(
  'payouts',
  async (job) => {
    const { payoutIds } = job.data;

    // Process payouts in batches of 10
    for (let i = 0; i < payoutIds.length; i += 10) {
      const batch = payoutIds.slice(i, i + 10);
      await Promise.all(batch.map(id => processStripePayout(id)));
    }
  },
  {
    connection,
    concurrency: 3,
  }
);
```

**Convert to Async:**

1. **Batch Generation** (currently blocking):
```typescript
// BEFORE: supabase/functions/generate-batches/index.ts
const result = await batchService.generateBatches(deliveryDate);
return new Response(JSON.stringify(result), { status: 200 });

// AFTER: Enqueue job and return immediately
const job = await queues.batchGeneration.add('generate', {
  deliveryDate,
  zipCodes,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});

return new Response(JSON.stringify({
  jobId: job.id,
  status: 'queued',
  estimatedTime: '2-5 minutes'
}), { status: 202 });  // 202 Accepted
```

2. **Payout Processing**:
```typescript
// Enqueue payouts instead of processing synchronously
await queues.payouts.add('process', { payoutIds }, {
  delay: 60000,  // Wait 1 minute before processing
  attempts: 5,
});
```

3. **Email Notifications**:
```typescript
// Already async, but move to queue for reliability
await queues.notifications.add('email', {
  type: 'order_confirmation',
  orderId,
  userId,
});
```

**Job Monitoring Dashboard:**
```typescript
// NEW: GET /admin/jobs
const counts = await queues.batchGeneration.getJobCounts();
// Returns: { waiting: 5, active: 2, completed: 150, failed: 3 }
```

**Success Metrics:**
- ✅ API response times <500ms (async operations moved to queue)
- ✅ 99.9% job completion rate
- ✅ <5 minute job processing time (P95)

**Cost:** $50/month (separate Redis instance for BullMQ)

### 4.4 Stripe Customer Caching

**Problem:** Stripe API calls are slow (200-500ms) and rate-limited (100 req/sec)

**Solution:** Cache Stripe customer IDs locally

```typescript
// UPDATED: CheckoutService.ts processPayment()
private async getOrCreateStripeCustomer(
  userId: string,
  userEmail: string
): Promise<string> {
  // Check cache first
  const cached = await cacheService.get<string>(`stripe:customer:${userEmail}`);
  if (cached) return cached;

  // Check local database
  const { data: profile } = await this.supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    // Store in cache for next time
    await cacheService.set(
      `stripe:customer:${userEmail}`,
      profile.stripe_customer_id,
      3600  // 1 hour
    );
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const customers = await this.stripe.customers.list({ email: userEmail, limit: 1 });

  let customerId: string;
  if (customers.data.length > 0) {
    customerId = customers.data[0].id;
  } else {
    const customer = await this.stripe.customers.create({
      email: userEmail,
      metadata: { supabase_user_id: userId }
    });
    customerId = customer.id;
  }

  // Store in database and cache
  await this.supabase
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);

  await cacheService.set(
    `stripe:customer:${userEmail}`,
    customerId,
    3600
  );

  return customerId;
}
```

**Add Database Column:**
```sql
-- NEW: supabase/migrations/20251121010000_add_stripe_customer_id.sql
ALTER TABLE profiles
ADD COLUMN stripe_customer_id TEXT;

CREATE INDEX idx_profiles_stripe_customer
ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;
```

**Success Metrics:**
- ✅ 80% cache hit rate for Stripe customers
- ✅ 50% reduction in Stripe API calls
- ✅ Checkout latency reduced by 200-500ms

**Cost:** $0 (uses existing Redis)

### 4.5 Self-Hosted OSRM Server

**Problem:** Public OSRM server has no SLA and may throttle at scale

**Solution:** Self-host OSRM routing engine on AWS EC2

```yaml
# docker-compose.yml for OSRM
version: '3'
services:
  osrm:
    image: osrm/osrm-backend:v5.27.1
    ports:
      - "5000:5000"
    volumes:
      - ./data:/data
    command: "osrm-routed --algorithm mld /data/us-west.osrm"

  # Load map data
  osrm-data:
    image: osrm/osrm-backend:v5.27.1
    volumes:
      - ./data:/data
    command: >
      bash -c "
        wget http://download.geofabrik.de/north-america/us-latest.osm.pbf -O /data/us.osm.pbf &&
        osrm-extract -p /opt/car.lua /data/us.osm.pbf &&
        osrm-partition /data/us.osrm &&
        osrm-customize /data/us.osrm
      "
```

**Infrastructure:**
- AWS EC2 t3.large (2 vCPU, 8GB RAM) - $60/month
- 100GB EBS storage for map data - $10/month
- Application Load Balancer - $20/month

**Update Code:**
```typescript
// UPDATED: supabase/functions/_shared/services/BatchOptimizationService.ts
const OSRM_URL = Deno.env.get('OSRM_URL') || 'http://osrm.blueharvests.internal:5000';

async optimizeRouteWithOsrm(stops: Stop[]): Promise<OptimizedRoute> {
  const coordinates = stops.map(s => `${s.lng},${s.lat}`).join(';');
  const url = `${OSRM_URL}/trip/v1/driving/${coordinates}?source=first&roundtrip=false`;

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  // ... rest of implementation
}
```

**Success Metrics:**
- ✅ 99.9% uptime for routing
- ✅ <500ms route optimization latency
- ✅ Zero dependency on public OSRM

**Cost:** $90/month (EC2 + EBS + ALB)

### Phase 2 Summary

| Item | Implementation Time | Cost/Month | Risk |
|------|---------------------|------------|------|
| Read replicas | 1 week | $400 | Medium |
| Redis caching | 2 weeks | $100 | Medium |
| Async job queue | 3 weeks | $50 | High |
| Stripe customer caching | 1 week | $0 | Low |
| Self-hosted OSRM | 2 weeks | $90 | Medium |
| **TOTAL** | **9 weeks** | **$640** | **Medium** |

**Success Criteria:**
- ✅ Handle 10,000 concurrent users
- ✅ P95 latency <1.5 seconds
- ✅ 80% cache hit rate
- ✅ 99.9% job completion rate

---

## 5. Phase 3: Geographic Distribution (10K → 50K Users)

**Timeline:** Months 7-12
**Cost:** $75,000/month
**Prerequisites:** Phase 2 complete

### 5.1 Multi-Region Deployment

**Problem:** Single region causes high latency for distant users

**Solution:** Deploy to 3 regions (US-West, US-East, EU-West)

**Architecture:**
```
                    ┌──────────────┐
                    │   Route 53   │  (GeoDNS routing)
                    │  (Global)    │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  US-West     │   │  US-East     │   │  EU-West     │
│  Oregon      │   │  Virginia    │   │  Ireland     │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       ▼                  ▼                  ▼
 ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 │ PostgreSQL  │◄───┤ PostgreSQL  │◄───┤ PostgreSQL  │
 │ (Primary)   │    │ (Replica)   │    │ (Replica)   │
 └─────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
 ┌─────────────┐
 │   Redis     │  (Replicated across regions)
 │  (Primary)  │
 └─────────────┘
```

**Route 53 GeoDNS:**
```terraform
resource "aws_route53_record" "api_us_west" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.blueharvests.com"
  type    = "A"

  geolocation_routing_policy {
    continent = "NA"
    country   = "US"
  }

  alias {
    name    = aws_lb.us_west.dns_name
    zone_id = aws_lb.us_west.zone_id
  }
}
```

**Database Replication:**
- Primary in US-West (all writes)
- Read replicas in US-East and EU-West
- <100ms replication lag acceptable
- Failover to US-East if US-West fails

**Success Metrics:**
- ✅ <200ms latency for 95% of users globally
- ✅ 99.95% uptime
- ✅ Automatic regional failover <30 seconds

**Cost:** $1,200/month (3× infrastructure)

### 5.2 CloudFlare Global CDN

**Problem:** Static assets and images still slow globally

**Solution:** Upgrade to CloudFlare Pro with Argo routing

```yaml
# cloudflare.yaml
zones:
  - zone: blueharvests.com
    plan: pro  # $20/month
    settings:
      argo: true  # Smart routing
      polish: lossless  # Image optimization
      mirage: true  # Lazy loading

    cache_rules:
      - name: "Product Images"
        match: "/images/products/*"
        ttl: 2592000  # 30 days

      - name: "Static Assets"
        match: "/assets/*"
        ttl: 31536000  # 1 year

      - name: "API Responses"
        match: "/api/products"
        ttl: 300  # 5 minutes
        edge_cache_ttl: 60  # 1 minute
```

**Image Optimization:**
- Automatic WebP conversion
- Responsive images with srcset
- Lazy loading for below-fold images

**Success Metrics:**
- ✅ 95% cache hit rate globally
- ✅ <100ms TTFB for static assets
- ✅ 50% reduction in image bandwidth

**Cost:** $200/month (CloudFlare Pro + bandwidth)

### 5.3 Database Partitioning

**Problem:** Orders and credits_ledger tables growing unbounded

**Solution:** Partition by date (monthly)

```sql
-- NEW: supabase/migrations/20251121020000_partition_orders.sql

-- Convert orders to partitioned table
CREATE TABLE orders_partitioned (
  LIKE orders INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create partitions for each month
CREATE TABLE orders_2025_11 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE orders_2025_12 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Migrate data (run during maintenance window)
INSERT INTO orders_partitioned SELECT * FROM orders;

-- Swap tables atomically
BEGIN;
  ALTER TABLE orders RENAME TO orders_old;
  ALTER TABLE orders_partitioned RENAME TO orders;
  -- Update foreign keys...
COMMIT;

-- Automatic partition creation function
CREATE OR REPLACE FUNCTION create_next_partition()
RETURNS void AS $$
DECLARE
  next_month DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 months');
  partition_name TEXT := 'orders_' || TO_CHAR(next_month, 'YYYY_MM');
BEGIN
  EXECUTE FORMAT('
    CREATE TABLE IF NOT EXISTS %I PARTITION OF orders
    FOR VALUES FROM (%L) TO (%L)
  ', partition_name, next_month, next_month + INTERVAL '1 month');
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron
SELECT cron.schedule('create_partitions', '0 0 1 * *', 'SELECT create_next_partition()');
```

**Partition Management:**
- Auto-create partitions 2 months in advance
- Archive partitions older than 2 years to S3
- Drop partitions older than 5 years (after legal retention)

**Success Metrics:**
- ✅ Query performance unchanged
- ✅ Partition pruning reduces scan time by 90%
- ✅ Simpler data archival and deletion

**Cost:** $0 (PostgreSQL feature)

### 5.4 Materialized Views for Analytics

**Problem:** Admin dashboards run expensive aggregation queries

**Solution:** Create materialized views with periodic refresh

```sql
-- NEW: supabase/migrations/20251121030000_materialized_views.sql

-- Daily revenue dashboard
CREATE MATERIALIZED VIEW daily_revenue AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue,
  AVG(total_amount) as avg_order_value,
  COUNT(DISTINCT consumer_id) as unique_customers
FROM orders
WHERE status IN ('completed', 'delivered')
GROUP BY DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON daily_revenue(date);

-- Refresh daily at 1 AM
SELECT cron.schedule(
  'refresh_daily_revenue',
  '0 1 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_revenue'
);

-- Product performance dashboard
CREATE MATERIALIZED VIEW product_performance AS
SELECT
  p.id,
  p.name,
  p.farm_profile_id,
  COUNT(oi.id) as times_ordered,
  SUM(oi.quantity) as total_quantity_sold,
  SUM(oi.subtotal) as total_revenue,
  AVG(oi.unit_price) as avg_price
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id
WHERE o.status IN ('completed', 'delivered')
GROUP BY p.id, p.name, p.farm_profile_id;

CREATE UNIQUE INDEX ON product_performance(id);

-- Refresh every hour
SELECT cron.schedule(
  'refresh_product_performance',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY product_performance'
);
```

**Admin Dashboard Updates:**
```typescript
// BEFORE: Heavy aggregation query
const { data } = await supabase
  .from('orders')
  .select('created_at, total_amount, consumer_id')
  .gte('created_at', startDate)
  .lte('created_at', endDate);

// Calculate metrics in application code...

// AFTER: Read from materialized view
const { data } = await supabase
  .from('daily_revenue')
  .select('*')
  .gte('date', startDate)
  .lte('date', endDate);

// Metrics pre-calculated, instant response
```

**Success Metrics:**
- ✅ Admin dashboard load time <500ms (vs 5-10 seconds)
- ✅ Zero impact on transactional queries
- ✅ 95% reduction in analytics query load

**Cost:** $0 (PostgreSQL feature)

### 5.5 Circuit Breakers for External APIs

**Problem:** External API failures cascade and block entire system

**Solution:** Implement circuit breaker pattern

```typescript
// NEW: supabase/functions/_shared/circuitBreaker.ts

interface CircuitBreakerOptions {
  failureThreshold: number;   // Open circuit after N failures
  resetTimeout: number;        // Try again after N milliseconds
  monitorInterval: number;     // Check health every N milliseconds
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private nextAttempt = Date.now();

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
    console.log(`[CIRCUIT BREAKER] ${this.name}: CLOSED`);
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      console.error(`[CIRCUIT BREAKER] ${this.name}: OPEN (failures: ${this.failures})`);
    }
  }
}

// Usage:
const stripeCircuitBreaker = new CircuitBreaker('stripe', {
  failureThreshold: 5,
  resetTimeout: 60000,  // 1 minute
  monitorInterval: 10000,
});

const osrmCircuitBreaker = new CircuitBreaker('osrm', {
  failureThreshold: 3,
  resetTimeout: 30000,  // 30 seconds
  monitorInterval: 5000,
});

// In CheckoutService:
const paymentIntent = await stripeCircuitBreaker.execute(() =>
  this.stripe.paymentIntents.create(params)
);

// In BatchOptimizationService:
const route = await osrmCircuitBreaker.execute(() =>
  this.optimizeRouteWithOsrm(stops)
);
```

**Fallback Strategies:**
```typescript
// Stripe payment fallback
try {
  return await stripeCircuitBreaker.execute(() => processPayment());
} catch (error) {
  // Fallback: Queue payment for retry
  await queues.payments.add('retry', { orderId, userId });
  return { status: 'pending', message: 'Payment will be processed shortly' };
}

// OSRM routing fallback (already exists, line 310-327 in BatchOptimizationService.ts)
try {
  return await osrmCircuitBreaker.execute(() => optimizeWithOsrm());
} catch (error) {
  console.warn('OSRM failed, falling back to haversine distance');
  return fallbackToGeographicBatching(stops);
}
```

**Success Metrics:**
- ✅ Graceful degradation during external API outages
- ✅ <1% order failure rate (vs 100% cascade failure)
- ✅ Auto-recovery within 1 minute of API restoration

**Cost:** $0 (code change only)

### Phase 3 Summary

| Item | Implementation Time | Cost/Month | Risk |
|------|---------------------|------------|------|
| Multi-region deployment | 4 weeks | $1,200 | High |
| CloudFlare Global CDN | 1 week | $200 | Low |
| Database partitioning | 2 weeks | $0 | High |
| Materialized views | 1 week | $0 | Low |
| Circuit breakers | 2 weeks | $0 | Medium |
| **TOTAL** | **10 weeks** | **$1,400** | **High** |

**Success Criteria:**
- ✅ Handle 50,000 concurrent users
- ✅ P95 latency <1 second globally
- ✅ 99.95% uptime
- ✅ Graceful degradation during external API failures

---

## 6. Phase 4: Enterprise Scale (50K → 100K Users)

**Timeline:** Months 13-18
**Cost:** $150,000/month
**Prerequisites:** Phase 3 complete

### 6.1 Microservices Architecture

**Problem:** Monolithic edge functions can't scale independently

**Solution:** Split into domain-specific microservices

**Service Decomposition:**
```
┌─────────────────┐
│  API Gateway    │  (Kong/AWS API Gateway)
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┬──────────┐
    │         │          │          │          │
    ▼         ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Auth   │ │Checkout│ │Batches │ │Payouts │ │ Notify │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
    │         │          │          │          │
    └────────┬┴──────────┴──────────┴──────────┘
             │
             ▼
    ┌────────────────┐
    │  Shared DB +   │
    │  Message Bus   │
    └────────────────┘
```

**Service Breakdown:**

| Service | Responsibility | Endpoints | Database Access |
|---------|----------------|-----------|-----------------|
| **auth-service** | Authentication, authorization | /auth/* | profiles, sessions |
| **product-service** | Product catalog, search | /products/* | products, farm_profiles |
| **cart-service** | Shopping cart management | /cart/* | carts, cart_items |
| **checkout-service** | Order placement, payment | /checkout | orders, payments |
| **batch-service** | Delivery batch generation | /batches/* | delivery_batches, batch_stops |
| **driver-service** | Route claiming, tracking | /driver/* | delivery_batches, batch_stops |
| **payout-service** | Farmer/driver payouts | /payouts/* | payouts, transfers |
| **notification-service** | Emails, push notifications | (internal only) | notifications |
| **analytics-service** | Metrics, dashboards | /admin/analytics | (read-only all tables) |

**Implementation Example:**
```typescript
// checkout-service/src/index.ts
import express from 'express';
import { createCheckoutUseCase } from './usecases/checkout';

const app = express();

app.post('/checkout', async (req, res) => {
  try {
    const result = await createCheckoutUseCase(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

**Inter-Service Communication:**
```typescript
// Event-driven architecture with NATS
import { connect } from 'nats';

const nats = await connect({ servers: 'nats://localhost:4222' });

// Checkout service publishes event
await nats.publish('order.created', JSON.stringify({
  orderId: '123',
  userId: '456',
  totalAmount: 50.00,
}));

// Notification service subscribes
const sub = nats.subscribe('order.created');
for await (const msg of sub) {
  const order = JSON.parse(msg.data);
  await sendOrderConfirmation(order);
}
```

**Benefits:**
- Independent scaling (scale checkout 10x, keep batches 1x)
- Independent deployments (no downtime)
- Technology diversity (use Go for batch-service if needed)
- Team autonomy (separate codebases)

**Challenges:**
- Distributed tracing required
- Service discovery complexity
- Data consistency across services
- Operational overhead

**Success Metrics:**
- ✅ <100ms inter-service latency
- ✅ Independent service scaling
- ✅ Zero-downtime deployments

**Cost:** $5,000/month (Kubernetes cluster + NATS)

### 6.2 Database Sharding

**Problem:** Single PostgreSQL instance can't handle 100K concurrent writes

**Solution:** Shard by user ID (consumer_id)

**Sharding Strategy:**
```
User ID: 123456789abc
Hash: md5(123456789abc) = a1b2c3...
Shard: a1b2c3... % 8 = Shard 3

┌────────────┐  ┌────────────┐  ┌────────────┐
│  Shard 0   │  │  Shard 1   │  │  Shard 2   │
│  users     │  │  users     │  │  users     │
│  0-1249... │  │  2500-3749 │  │  5000-6249 │
└────────────┘  └────────────┘  └────────────┘

┌────────────┐  ┌────────────┐  ┌────────────┐
│  Shard 3   │  │  Shard 4   │  │  Shard 5   │
│  users     │  │  users     │  │  users     │
│  7500-8749 │  │  a000-b249 │  │  c500-d749 │
└────────────┘  └────────────┘  └────────────┘

┌────────────┐  ┌────────────┐
│  Shard 6   │  │  Shard 7   │
│  users     │  │  users     │
│  e000-f249 │  │  f500-ffff │
└────────────┘  └────────────┘
```

**Shard Routing:**
```typescript
// NEW: shared/database/shardRouter.ts
import { createHash } from 'crypto';

const SHARD_COUNT = 8;
const shardConnections = new Map<number, SupabaseClient>();

// Initialize shard connections
for (let i = 0; i < SHARD_COUNT; i++) {
  shardConnections.set(i, createClient(
    Deno.env.get(`SUPABASE_SHARD_${i}_URL`)!,
    Deno.env.get(`SUPABASE_SERVICE_ROLE_KEY`)!
  ));
}

export function getShardForUser(userId: string): SupabaseClient {
  const hash = createHash('md5').update(userId).digest('hex');
  const shardId = parseInt(hash.substring(0, 8), 16) % SHARD_COUNT;
  return shardConnections.get(shardId)!;
}

// Usage in checkout:
const shard = getShardForUser(userId);
const { data: cart } = await shard
  .from('carts')
  .select('*')
  .eq('consumer_id', userId);
```

**Cross-Shard Queries:**
```typescript
// For admin dashboards, query all shards in parallel
async function getTotalOrders(date: string): Promise<number> {
  const promises = Array.from(shardConnections.values()).map(shard =>
    shard
      .from('orders')
      .select('count', { count: 'exact', head: true })
      .eq('created_at', date)
  );

  const results = await Promise.all(promises);
  return results.reduce((sum, r) => sum + (r.count || 0), 0);
}
```

**Tables to Shard:**
- ✅ `carts`, `cart_items` (by consumer_id)
- ✅ `orders`, `order_items` (by consumer_id)
- ✅ `credits_ledger` (by consumer_id)
- ✅ `profiles` (by id)
- ❌ `products`, `farm_profiles` (replicated to all shards)
- ❌ `delivery_batches`, `batch_stops` (shared database)

**Success Metrics:**
- ✅ 8× database write capacity
- ✅ Linear scalability (add more shards as needed)
- ✅ <100ms shard routing overhead

**Cost:** $3,200/month (8× database shards at $400 each)

### 6.3 Kubernetes Orchestration

**Problem:** Manual service management doesn't scale

**Solution:** Deploy on AWS EKS with auto-scaling

**Cluster Configuration:**
```yaml
# kubernetes/cluster.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: blueharvests-prod
  region: us-west-2
  version: '1.28'

nodeGroups:
  - name: general-purpose
    instanceType: t3.xlarge
    minSize: 10
    maxSize: 100
    desiredCapacity: 20
    volumeSize: 100
    iam:
      withAddonPolicies:
        autoScaler: true
        cloudWatch: true

  - name: compute-optimized
    instanceType: c5.2xlarge
    minSize: 5
    maxSize: 50
    desiredCapacity: 10
    labels:
      workload: batch-processing
```

**Service Deployment:**
```yaml
# kubernetes/checkout-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-service
spec:
  replicas: 10
  selector:
    matchLabels:
      app: checkout-service
  template:
    metadata:
      labels:
        app: checkout-service
    spec:
      containers:
      - name: checkout
        image: blueharvests/checkout-service:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-service
  minReplicas: 10
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Auto-Scaling Policies:**
- Scale up: CPU >70% for 2 minutes
- Scale down: CPU <30% for 10 minutes
- Max pods per service: 100
- Min pods per service: 10

**Success Metrics:**
- ✅ Auto-scaling responds within 2 minutes
- ✅ 99.99% container uptime
- ✅ <10 second pod startup time

**Cost:** $5,000/month (EKS control plane + nodes)

### 6.4 Observability Platform

**Problem:** Can't debug issues in distributed system without visibility

**Solution:** Comprehensive observability stack

**Stack Components:**

| Component | Purpose | Tool | Cost/Month |
|-----------|---------|------|------------|
| **Logs** | Centralized logging | DataDog | $2,000 |
| **Metrics** | Performance monitoring | Prometheus + Grafana | $500 |
| **Traces** | Distributed tracing | Jaeger | $300 |
| **Alerts** | Incident management | PagerDuty | $200 |
| **APM** | Application performance | New Relic | $1,500 |

**Distributed Tracing:**
```typescript
// NEW: shared/tracing.ts
import { trace, context } from '@opentelemetry/api';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { NodeTracerProvider } from '@opentelemetry/node';

const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({ endpoint: 'http://jaeger:14268/api/traces' });

provider.addSpanProcessor(new BatchSpanProcessor(exporter));
provider.register();

// Usage in checkout:
const tracer = trace.getTracer('checkout-service');

export async function processCheckout(input: CheckoutInput) {
  const span = tracer.startSpan('checkout.process');
  span.setAttribute('user.id', input.userId);

  try {
    // Database call
    const cartSpan = tracer.startSpan('checkout.getCart', { parent: span });
    const cart = await getCart(input.userId);
    cartSpan.end();

    // Stripe call
    const paymentSpan = tracer.startSpan('checkout.processPayment', { parent: span });
    const payment = await processPayment(cart.total);
    paymentSpan.end();

    span.setStatus({ code: SpanStatusCode.OK });
    return { orderId: '123' };
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

**Dashboards:**
- Service health (error rate, latency, throughput)
- Database performance (query time, connection pool)
- External API status (Stripe, Mapbox, OSRM)
- Business metrics (orders/min, revenue, conversion rate)

**Alerts:**
```yaml
# alerts/checkout-service.yaml
alerts:
  - name: HighCheckoutErrorRate
    condition: error_rate > 5% for 5 minutes
    severity: critical
    notify: pagerduty

  - name: SlowCheckoutLatency
    condition: p95_latency > 3000ms for 10 minutes
    severity: warning
    notify: slack

  - name: StripeAPIDown
    condition: stripe_error_rate > 50% for 2 minutes
    severity: critical
    notify: pagerduty + sms
```

**Success Metrics:**
- ✅ <5 minute mean time to detection (MTTD)
- ✅ <30 minute mean time to resolution (MTTR)
- ✅ 100% incident root cause identified

**Cost:** $4,500/month (full observability stack)

### 6.5 Load Testing & Capacity Planning

**Problem:** Don't know system limits until production traffic hits

**Solution:** Continuous load testing with k6

```typescript
// load-tests/checkout.test.ts
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 10000 },   // Ramp up to 10K users
    { duration: '30m', target: 10000 },  // Stay at 10K
    { duration: '5m', target: 50000 },   // Spike to 50K
    { duration: '10m', target: 50000 },  // Stay at 50K
    { duration: '5m', target: 100000 },  // Spike to 100K
    { duration: '10m', target: 100000 }, // Stay at 100K
    { duration: '5m', target: 0 },       // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% under 2s
    http_req_failed: ['rate<0.01'],     // Less than 1% errors
  },
};

export default function () {
  const payload = JSON.stringify({
    cart_id: 'test-cart',
    use_credits: true,
  });

  const res = http.post('https://api.blueharvests.com/checkout', payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'checkout succeeded': (r) => JSON.parse(r.body).success === true,
  });

  sleep(1);
}
```

**Run Schedule:**
- Nightly: 10K concurrent users (30 min)
- Weekly: 50K concurrent users (1 hour)
- Monthly: 100K concurrent users (2 hours)
- Pre-release: Full load test (4 hours)

**Capacity Planning:**
```typescript
// Analyze results and project capacity
interface LoadTestResult {
  maxUsers: number;
  p95Latency: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

function calculateCapacity(result: LoadTestResult): number {
  const cpuCapacity = (100 - result.cpuUsage) / result.cpuUsage * result.maxUsers;
  const latencyCapacity = (2000 / result.p95Latency) * result.maxUsers;
  const errorCapacity = (0.01 / result.errorRate) * result.maxUsers;

  return Math.min(cpuCapacity, latencyCapacity, errorCapacity);
}
```

**Success Metrics:**
- ✅ Weekly load tests with zero failures
- ✅ Capacity headroom >50% above peak traffic
- ✅ Documented scaling procedures

**Cost:** $500/month (k6 Cloud for distributed load testing)

### Phase 4 Summary

| Item | Implementation Time | Cost/Month | Risk |
|------|---------------------|------------|------|
| Microservices architecture | 8 weeks | $5,000 | High |
| Database sharding | 6 weeks | $3,200 | Very High |
| Kubernetes orchestration | 4 weeks | $5,000 | High |
| Observability platform | 3 weeks | $4,500 | Medium |
| Load testing & capacity planning | 2 weeks | $500 | Low |
| **TOTAL** | **23 weeks** | **$18,200** | **High** |

**Success Criteria:**
- ✅ Handle 100,000 concurrent users
- ✅ P95 latency <1 second
- ✅ 99.99% uptime
- ✅ Auto-scaling with <2 minute response time
- ✅ Full observability and alerting

---

## 7. Infrastructure Cost Breakdown

### 7.1 Cost by Phase

| Phase | Users | Monthly Cost | Annual Cost | Per-User Cost |
|-------|-------|--------------|-------------|---------------|
| Phase 0 (Current) | 100 | $500 | $6,000 | $5.00 |
| Phase 1 | 1,000 | $640 | $7,680 | $0.64 |
| Phase 2 | 10,000 | $1,280 | $15,360 | $0.13 |
| Phase 3 | 50,000 | $2,680 | $32,160 | $0.05 |
| Phase 4 | 100,000 | $20,880 | $250,560 | $0.21 |

### 7.2 Detailed Cost Breakdown (Phase 4)

| Category | Service | Monthly Cost | Notes |
|----------|---------|--------------|-------|
| **Database** | Supabase Pro (Primary) | $400 | 8 CPU, 32GB RAM |
| | Read Replicas (3×) | $1,200 | US-East, US-West, EU |
| | Shards (8×) | $3,200 | User data distribution |
| | **Subtotal** | **$4,800** | |
| **Caching** | Upstash Redis Pro | $100 | 10GB, multi-region |
| | BullMQ Redis | $50 | Job queue |
| | **Subtotal** | **$150** | |
| **Compute** | AWS EKS Control Plane | $72 | Managed Kubernetes |
| | EC2 Nodes (General) | $3,500 | 20× t3.xlarge |
| | EC2 Nodes (Compute) | $1,500 | 10× c5.2xlarge |
| | **Subtotal** | **$5,072** | |
| **Networking** | CloudFlare Pro | $200 | Global CDN |
| | AWS Load Balancers | $300 | ALB + NLB |
| | Data Transfer | $800 | Outbound bandwidth |
| | **Subtotal** | **$1,300** | |
| **Storage** | S3 (Images) | $100 | 5TB product images |
| | EBS (OSRM) | $10 | 100GB map data |
| | Backups | $200 | Automated snapshots |
| | **Subtotal** | **$310** | |
| **External APIs** | Stripe (transaction fees) | Varies | 2.9% + $0.30 per charge |
| | Mapbox | $50 | Geocoding API |
| | Self-hosted OSRM | $90 | EC2 + ALB |
| | **Subtotal** | **$140** | |
| **Observability** | DataDog | $2,000 | Logs + APM |
| | New Relic | $1,500 | Application monitoring |
| | Grafana Cloud | $500 | Metrics + dashboards |
| | PagerDuty | $200 | Incident management |
| | k6 Cloud | $500 | Load testing |
| | **Subtotal** | **$4,700** | |
| **Message Queue** | NATS Cloud | $300 | Event streaming |
| **Misc** | GitHub Enterprise | $21 | CI/CD pipelines |
| | SSL Certificates | $100 | Wildcard certs |
| | DNS (Route 53) | $50 | GeoDNS routing |
| | **Subtotal** | **$171** | |
| | | | |
| **GRAND TOTAL** | | **$20,880** | |

### 7.3 Variable Costs

**Transaction-Based:**
- Stripe: 2.9% + $0.30 per transaction
- At 100K orders/month: ~$3,000/month in fees
- Mapbox: $0.50/1K geocoding requests
- At 500 geocodes/day: ~$7/month

**Bandwidth:**
- Outbound data transfer: $0.09/GB (AWS)
- At 100TB/month: ~$9,000/month
- CloudFlare CDN reduces this by ~70%: ~$2,700/month saved

**Database Storage:**
- $0.10/GB/month (Supabase)
- Orders table: ~500GB after 1 year
- ~$50/month storage cost

---

## 8. Implementation Timeline

### 8.1 Gantt Chart

```
Months:  1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17  18
Phase 1: [===========]
Phase 2:     [===================]
Phase 3:             [==============================]
Phase 4:                                     [================================]

Milestone 1: 1K users      ↑
Milestone 2: 10K users              ↑
Milestone 3: 50K users                                ↑
Milestone 4: 100K users                                                        ↑
```

### 8.2 Critical Path

```
Start
  │
  ├─ Month 1-3: Phase 1 (Foundation)
  │   ├─ Week 1-2: PgBouncer + Redis rate limiting
  │   ├─ Week 3-4: Database indexes + CDN
  │   ├─ Week 5-6: Pagination + testing
  │   └─ MILESTONE: 1K users ✓
  │
  ├─ Month 4-6: Phase 2 (Horizontal Scaling)
  │   ├─ Week 7-9: Read replicas + Redis caching
  │   ├─ Week 10-12: Async job queue
  │   ├─ Week 13-15: Stripe caching + OSRM
  │   └─ MILESTONE: 10K users ✓
  │
  ├─ Month 7-12: Phase 3 (Geographic Distribution)
  │   ├─ Week 16-19: Multi-region deployment
  │   ├─ Week 20-21: Global CDN
  │   ├─ Week 22-23: Database partitioning
  │   ├─ Week 24-25: Materialized views + circuit breakers
  │   └─ MILESTONE: 50K users ✓
  │
  └─ Month 13-18: Phase 4 (Enterprise Scale)
      ├─ Week 26-33: Microservices architecture
      ├─ Week 34-39: Database sharding
      ├─ Week 40-43: Kubernetes orchestration
      ├─ Week 44-46: Observability platform
      ├─ Week 47-48: Load testing
      └─ MILESTONE: 100K users ✓
```

### 8.3 Team Requirements

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|------|---------|---------|---------|---------|-------|
| Backend Engineers | 2 | 3 | 4 | 5 | 5 |
| DevOps Engineers | 1 | 1 | 2 | 3 | 3 |
| Database Specialist | - | 1 | 1 | 2 | 2 |
| QA/Load Testing | - | 1 | 1 | 2 | 2 |
| Tech Lead | 1 | 1 | 1 | 1 | 1 |
| **Total FTEs** | **4** | **7** | **9** | **13** | **13** |

### 8.4 Milestones & Gates

| Milestone | Date | Criteria | Gate |
|-----------|------|----------|------|
| **M1: Foundation** | Month 3 | 1K users, <2s P95 latency | Load test 1.5K users |
| **M2: Horizontal** | Month 6 | 10K users, 80% cache hit | Load test 15K users |
| **M3: Geographic** | Month 12 | 50K users, 99.95% uptime | Load test 75K users |
| **M4: Enterprise** | Month 18 | 100K users, 99.99% uptime | Load test 150K users |

**Gate Criteria:**
- All load tests pass with <1% error rate
- Zero critical bugs in production
- Runbook documentation complete
- Team training complete
- Incident response tested

---

## 9. Risk Mitigation

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Database migration failure** | Medium | Critical | Blue-green deployment, rollback plan |
| **Data consistency issues** | High | Critical | Extensive testing, gradual rollout |
| **Performance regression** | Medium | High | Continuous load testing, monitoring |
| **Third-party API failures** | High | Medium | Circuit breakers, fallback strategies |
| **Security vulnerabilities** | Low | Critical | Security audits, penetration testing |
| **Vendor lock-in** | Medium | Medium | Abstract infrastructure with Terraform |

### 9.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Team knowledge gaps** | High | High | Training, documentation, pair programming |
| **Cost overruns** | Medium | High | Monthly budget reviews, cost alerts |
| **Timeline delays** | High | Medium | Buffer time (20%), parallel work streams |
| **Scope creep** | Medium | Medium | Strict change management, phase gates |
| **Production incidents** | Medium | Critical | Comprehensive monitoring, on-call rotation |

### 9.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Insufficient funding** | Low | Critical | Phased approach, demonstrate ROI early |
| **Customer churn** | Medium | High | Gradual rollout, feature flags, A/B testing |
| **Regulatory changes** | Low | Medium | Legal review, compliance monitoring |
| **Market competition** | Medium | Medium | Focus on unique value prop, speed to market |

### 9.4 Contingency Plans

**If Phase 1 exceeds budget:**
- Defer CDN to Phase 2
- Use Supabase connection pooling instead of PgBouncer
- Manual database indexes instead of automated

**If Phase 2 timeline slips:**
- Defer OSRM self-hosting
- Reduce read replica count (2 instead of 3)
- Simplify async job queue (use Supabase functions + cron)

**If Phase 3 fails load test:**
- Add more read replicas
- Increase cache TTL
- Reduce real-time polling frequency

**If Phase 4 cost prohibitive:**
- Defer microservices (keep monolith)
- Reduce shard count (4 instead of 8)
- Use self-managed Kubernetes (EKS → self-hosted)

---

## 10. Conclusion

Scaling from 100 to 100,000 concurrent users requires:

**Technical Transformation:**
- Move from monolith to microservices
- Single database → 8 sharded databases + read replicas
- No caching → Multi-layer caching (Redis + CDN)
- Synchronous processing → Event-driven async architecture
- Single region → Multi-region with GeoDNS

**Infrastructure Investment:**
- $500/month → $20,880/month (42× increase)
- 1 database → 12 databases (1 primary + 3 replicas + 8 shards)
- 0 caching → 2 Redis clusters + CDN
- No orchestration → Kubernetes with auto-scaling

**Team Growth:**
- 4 engineers → 13 engineers
- 18 months implementation
- $50K-$150K/month infrastructure cost
- $1.5M-$2M total investment

**Key Success Factors:**
1. Phased approach (don't try to do everything at once)
2. Continuous load testing (know your limits)
3. Comprehensive monitoring (detect issues before users do)
4. Gradual rollout (feature flags + A/B testing)
5. Strong team (hire experienced engineers for Phases 3-4)

**Next Steps:**
1. Get executive buy-in for 18-month roadmap
2. Secure $2M budget ($1.5M engineering + $500K infrastructure)
3. Hire Phase 1 team (4 engineers)
4. Begin Phase 1 immediately (foundation work)
5. Re-evaluate after each phase milestone

---

**Document Version:** 1.0
**Last Updated:** November 21, 2025
**Owner:** Engineering Leadership
**Reviewed By:** CTO, VP Engineering, Head of Infrastructure
