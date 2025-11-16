/**
 * AUTH MIDDLEWARE OPTIONS HANDLING TESTS
 * 
 * Tests that authentication middleware properly handles OPTIONS preflight requests
 * by skipping authentication checks.
 */

import { assertEquals } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { withAuth } from '../_shared/middleware/withAuth.ts';
import { withAdminAuth } from '../_shared/middleware/withAdminAuth.ts';
import { withDriverAuth } from '../_shared/middleware/withDriverAuth.ts';
import { withRateLimit } from '../_shared/middleware/withRateLimit.ts';
import { withValidation } from '../_shared/middleware/withValidation.ts';
import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { RATE_LIMITS } from '../_shared/constants.ts';

// Mock Supabase client
const mockSupabase = createClient('https://test.supabase.co', 'test-key');

Deno.test('withAuth - allows OPTIONS requests without authentication', async () => {
  const handler = withAuth(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'OPTIONS' });
  const ctx = { supabase: mockSupabase };
  
  const response = await handler(req, ctx);

  // Should pass through to handler without authentication
  assertEquals(response.status, 200);
  const body = await response.text();
  assertEquals(body, 'OK');
});

Deno.test('withAuth - rejects non-OPTIONS requests without authorization', async () => {
  const handler = withAuth(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'POST' });
  const ctx = { supabase: mockSupabase };
  
  const response = await handler(req, ctx);

  // Should reject with 401
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.error, 'UNAUTHORIZED');
});

Deno.test('withAdminAuth - allows OPTIONS requests without authentication', async () => {
  const handler = withAdminAuth(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'OPTIONS' });
  const ctx = { supabase: mockSupabase };
  
  const response = await handler(req, ctx);

  // Should pass through to handler without authentication
  assertEquals(response.status, 200);
  const body = await response.text();
  assertEquals(body, 'OK');
});

Deno.test('withAdminAuth - rejects non-OPTIONS requests without authorization', async () => {
  const handler = withAdminAuth(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'POST' });
  const ctx = { supabase: mockSupabase };
  
  const response = await handler(req, ctx);

  // Should reject with 401
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.error, 'UNAUTHORIZED');
});

Deno.test('withDriverAuth - allows OPTIONS requests without authentication', async () => {
  const handler = withDriverAuth(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'OPTIONS' });
  const ctx = { 
    supabase: mockSupabase,
    user: { id: 'test-user' } as User 
  };
  
  const response = await handler(req, ctx);

  // Should pass through to handler without role check
  assertEquals(response.status, 200);
  const body = await response.text();
  assertEquals(body, 'OK');
});

Deno.test('withRateLimit - allows OPTIONS requests without rate limiting', async () => {
  const handler = withRateLimit(RATE_LIMITS.GENERAL)(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'OPTIONS' });
  const ctx = { 
    supabase: mockSupabase,
    user: { id: 'test-user' } as User 
  };
  
  const response = await handler(req, ctx);

  // Should pass through without checking rate limits
  assertEquals(response.status, 200);
  const body = await response.text();
  assertEquals(body, 'OK');
});

Deno.test('withValidation - allows OPTIONS requests without validation', async () => {
  const TestSchema = z.object({
    email: z.string().email(),
    amount: z.number().positive(),
  });

  const handler = withValidation(TestSchema)(async (req, ctx) => {
    return new Response('OK', { status: 200 });
  });

  const req = new Request('https://test.com/test', { method: 'OPTIONS' });
  const ctx = { corsHeaders: {} };
  
  const response = await handler(req, ctx);

  // Should pass through without validation
  assertEquals(response.status, 200);
  const body = await response.text();
  assertEquals(body, 'OK');
});
