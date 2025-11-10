# Security Hardening Guide

This document describes the security enhancements implemented across the edge function layer.

## Overview

Security hardening focuses on three critical areas:
1. **API Key Rotation** - Automated key lifecycle management
2. **Enhanced Webhook Verification** - Protection against replay attacks
3. **Payload Encryption** - End-to-end encryption for sensitive data

## 1. API Key Rotation System

### Features

- **Version Tracking**: All API keys are versioned for audit trails
- **Graceful Transition**: Configurable transition periods during rotation
- **Automatic Expiration**: Old keys are automatically expired after transition
- **Usage Auditing**: Track when and how keys are used

### Database Schema

```sql
-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL, -- 'stripe', 'mapbox', 'osrm', etc.
  key_hash TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'transitioning', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  UNIQUE(service, version)
);

-- API Key audit log
CREATE TABLE api_key_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  request_id TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook logs (replay prevention)
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  signature TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Usage

#### Check Key Rotation Status

```bash
# Get status of all API keys
curl https://your-project.supabase.co/functions/v1/rotate-api-keys?action=status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response:
{
  "success": true,
  "keys": [
    {
      "service": "stripe",
      "version": 3,
      "status": "active",
      "daysUntilExpiration": 342
    },
    {
      "service": "mapbox",
      "version": 2,
      "status": "transitioning",
      "daysUntilExpiration": 5
    }
  ],
  "needs_rotation": ["osrm"],
  "recommendation": "Services requiring rotation: osrm"
}
```

#### Rotate API Key

```typescript
// Rotate Stripe key with 7-day transition
const result = await supabase.functions.invoke('rotate-api-keys', {
  body: {
    action: 'rotate',
    service: 'stripe',
    newKey: 'sk_live_new_key',
    transitionDays: 7
  }
});

// Response:
{
  "success": true,
  "newVersion": 4,
  "transitionPeriod": "7 days"
}
```

#### Expire Old Keys

```bash
# Manually expire all transitioning keys past their expiration date
curl -X POST https://your-project.supabase.co/functions/v1/rotate-api-keys?action=expire \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Response:
{
  "success": true,
  "expired_count": 2,
  "message": "2 keys expired"
}
```

### Automated Rotation Schedule

Recommended rotation schedule:
- **Stripe Keys**: Every 90 days
- **Mapbox Tokens**: Every 180 days
- **Internal Secrets**: Every 30 days

Set up a cron job to check rotation status:

```typescript
// Cron: Daily at 2 AM
const needsRotation = await checkKeyRotationNeeded(supabase);

if (needsRotation.length > 0) {
  // Send alert to admins
  await sendAlert({
    title: 'API Keys Need Rotation',
    services: needsRotation,
    urgency: 'high'
  });
}
```

## 2. Enhanced Webhook Verification

### Features

- **Signature Verification**: HMAC-based signature validation
- **Replay Attack Prevention**: Track processed webhook IDs
- **Timestamp Validation**: Reject old webhook requests (>5 minutes)
- **IP Allowlisting**: Restrict webhooks to known IPs

### Usage

#### Basic Webhook Verification

```typescript
import { verifyWebhook } from '../_shared/security/webhookVerification.ts';
import { STRIPE_IP_ALLOWLIST } from '../_shared/security/webhookVerification.ts';

const handler = async (req: Request, ctx: Context) => {
  // Verify webhook with all security checks
  const verification = await verifyWebhook(supabase, req, {
    secret: Deno.env.get('WEBHOOK_SECRET')!,
    source: 'stripe',
    checkReplay: true,
    ipAllowlist: STRIPE_IP_ALLOWLIST
  });

  if (!verification.valid) {
    console.error(`[WEBHOOK] Verification failed: ${verification.error}`);
    return new Response(
      JSON.stringify({ error: verification.error }),
      { status: 401 }
    );
  }

  // Process webhook safely
  const payload = await req.json();
  // ... handle webhook
};
```

#### Stripe-Specific Verification

```typescript
// Stripe webhook with replay protection
const verification = await verifyWebhook(supabase, req, {
  secret: Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
  source: 'stripe',
  checkReplay: true,
  ipAllowlist: STRIPE_IP_ALLOWLIST
});
```

#### Custom Webhook Verification

```typescript
// Generic HMAC webhook (e.g., GitHub, Shopify)
const verification = await verifyWebhook(supabase, req, {
  secret: Deno.env.get('CUSTOM_WEBHOOK_SECRET')!,
  source: 'custom-service',
  checkReplay: true
});
```

### Replay Attack Prevention

How it works:
1. Extract unique webhook ID from headers
2. Check if ID exists in `webhook_logs` table
3. Reject if already processed
4. Log webhook for future checks

```sql
-- Check for duplicate webhooks
SELECT id FROM webhook_logs 
WHERE webhook_id = 'evt_123' 
AND source = 'stripe'
LIMIT 1;

-- If exists, reject (replay attack)
-- If not exists, process and insert log
```

### IP Allowlisting

Pre-configured IP ranges for major services:

```typescript
// Stripe IPs (updated regularly)
export const STRIPE_IP_ALLOWLIST = [
  '3.18.12.0/22',
  '3.130.192.0/22',
  '13.235.14.0/24',
  // ... more ranges
];

// Verify request originates from allowed IP
const requestIP = req.headers.get('x-forwarded-for')?.split(',')[0];
const allowed = STRIPE_IP_ALLOWLIST.some(cidr => 
  isIPInRange(requestIP, cidr)
);
```

## 3. Payload Encryption

### Features

- **AES-256-GCM Encryption**: Industry-standard authenticated encryption
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Automatic Encryption/Decryption**: Middleware handles transparently
- **Sensitive Data Redaction**: Remove PII from logs

### Usage

#### Encrypt Sensitive Data

```typescript
import { encryptJSON, decryptJSON } from '../_shared/security/encryption.ts';

// Encrypt user data before storage
const sensitiveData = {
  ssn: '123-45-6789',
  credit_card: '4242424242424242'
};

const encrypted = await encryptJSON(
  sensitiveData,
  Deno.env.get('ENCRYPTION_SECRET')!
);

// Store encrypted data
await supabase.from('sensitive_data').insert({
  user_id: userId,
  encrypted_data: encrypted
});
```

#### Decrypt Sensitive Data

```typescript
// Retrieve and decrypt
const { data } = await supabase
  .from('sensitive_data')
  .select('encrypted_data')
  .eq('user_id', userId)
  .single();

const decrypted = await decryptJSON(
  data.encrypted_data,
  Deno.env.get('ENCRYPTION_SECRET')!
);

console.log(decrypted); // { ssn: '123-45-6789', ... }
```

#### Encryption Middleware

Automatically encrypt/decrypt requests/responses:

```typescript
import { withEncryption } from '../_shared/middleware/withEncryption.ts';

const handler = withEncryption(async (req, ctx) => {
  // Request is automatically decrypted
  const body = await req.json();
  
  // Process sensitive data
  const result = await processSensitiveData(body);
  
  // Response is automatically encrypted if requested
  return new Response(JSON.stringify(result));
});
```

Client-side encryption request:

```typescript
// Client encrypts before sending
const encrypted = await encryptJSON(sensitiveData, sharedSecret);

const response = await fetch('/api/sensitive', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-accept-encryption': 'true' // Request encrypted response
  },
  body: JSON.stringify({ encrypted: true, data: encrypted })
});

// Server returns encrypted response
const { data } = await response.json();
const decrypted = await decryptJSON(data, sharedSecret);
```

#### Redact Sensitive Data from Logs

```typescript
import { redactSensitiveData } from '../_shared/security/encryption.ts';

const userData = {
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123',
  ssn: '123-45-6789',
  credit_card: '4242424242424242'
};

// Redact before logging
const safeData = redactSensitiveData(userData);
console.log('[USER_DATA]', safeData);

// Output:
// [USER_DATA] {
//   name: 'John Doe',
//   email: 'john@example.com',
//   password: '[REDACTED]',
//   ssn: '[REDACTED]',
//   credit_card: '[REDACTED]'
// }
```

## Security Best Practices

### 1. Secret Management

```typescript
// ✅ GOOD: Use environment variables
const apiKey = Deno.env.get('STRIPE_SECRET_KEY');

// ❌ BAD: Hardcode secrets
const apiKey = 'sk_live_abc123';
```

### 2. Always Validate Input

```typescript
import { z } from 'zod';

// ✅ GOOD: Validate all inputs
const schema = z.object({
  amount: z.number().positive().max(1000000),
  email: z.string().email()
});

const validated = schema.parse(input);
```

### 3. Use Secure Tokens

```typescript
import { generateSecureToken } from '../_shared/security/encryption.ts';

// ✅ GOOD: Cryptographically secure tokens
const token = generateSecureToken(32); // 32 bytes

// ❌ BAD: Predictable tokens
const token = Math.random().toString(36);
```

### 4. Implement Rate Limiting

```typescript
// ✅ GOOD: Rate limit sensitive endpoints
withRateLimit({ requests: 10, window: '1m' })

// Prevents brute force attacks
```

### 5. Log Security Events

```typescript
import { logSecurityEvent } from '../_shared/monitoring/metrics.ts';

// Log failed authentication attempts
logSecurityEvent(requestId, 'auth_failure', userId, {
  ip: requestIP,
  attempts: failedAttempts
});
```

## Security Checklist

### API Endpoints
- [ ] Authentication required for sensitive operations
- [ ] Input validation using Zod schemas
- [ ] Rate limiting implemented
- [ ] Error messages don't leak information
- [ ] Sensitive data encrypted at rest
- [ ] Audit logging enabled

### Webhook Endpoints
- [ ] Signature verification enabled
- [ ] Replay attack prevention active
- [ ] IP allowlisting configured
- [ ] Timestamp validation (< 5 minutes)
- [ ] HTTPS enforced

### Database
- [ ] RLS policies enabled on all tables
- [ ] Sensitive columns encrypted
- [ ] Audit logs immutable
- [ ] Regular backups configured
- [ ] Connection pooling enabled

### Monitoring
- [ ] Failed auth attempts tracked
- [ ] Unusual activity alerts configured
- [ ] API key rotation reminders set
- [ ] Webhook verification failures logged
- [ ] Security metrics dashboard active

## Incident Response

### Compromised API Key

1. **Immediate**: Rotate key using rotation endpoint
2. **Investigate**: Check audit logs for unauthorized usage
3. **Notify**: Alert affected services/users
4. **Document**: Record incident details
5. **Review**: Update security procedures

### Webhook Replay Attack

1. **Detect**: Monitor webhook logs for duplicates
2. **Block**: Verification automatically rejects
3. **Alert**: Security team notified
4. **Investigate**: Check for additional suspicious activity
5. **Document**: Log incident for review

### Data Breach

1. **Contain**: Disable affected endpoints
2. **Assess**: Determine scope of breach
3. **Notify**: Inform affected users (legal requirement)
4. **Remediate**: Fix vulnerability
5. **Audit**: Review all security controls

## Compliance

### GDPR Compliance
- ✅ Data encryption at rest and in transit
- ✅ Right to erasure (delete user data)
- ✅ Data access logs (audit trail)
- ✅ Consent management

### PCI DSS Compliance (if handling payments)
- ✅ Never store full credit card numbers
- ✅ Use Stripe for payment processing
- ✅ Encrypt cardholder data
- ✅ Maintain secure network
- ✅ Regular security testing

### HIPAA Compliance (if handling health data)
- ✅ Encryption of ePHI
- ✅ Access controls
- ✅ Audit logs
- ✅ Business Associate Agreement with vendors

## Summary

Security hardening has implemented:
- **API Key Rotation**: Automated lifecycle management with 90-day rotation
- **Webhook Verification**: Multi-layer protection against attacks
- **Payload Encryption**: AES-256-GCM for sensitive data

These enhancements significantly improve the security posture of the application.
