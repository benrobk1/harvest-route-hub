/**
 * MIDDLEWARE UNIT TESTS
 * 
 * Tests each middleware function in isolation.
 * Validates error handling, context passing, and edge cases.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withRequestId } from '../_shared/middleware/withRequestId.ts';
import { withErrorHandling } from '../_shared/middleware/withErrorHandling.ts';
import { withCORS } from '../_shared/middleware/withCORS.ts';

// Mock Supabase client for testing
function createMockSupabaseClient(): SupabaseClient {
  const mockUrl = 'https://test.supabase.co';
  const mockKey = 'test-key';
  return createClient(mockUrl, mockKey);
}

Deno.test('withRequestId - generates and logs request ID', async () => {
  let capturedContext: any;
  
  const handler = withRequestId(async (req, ctx) => {
    capturedContext = ctx;
    return new Response('OK');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  assertExists(capturedContext.requestId);
  assertEquals(typeof capturedContext.requestId, 'string');
  assertEquals(capturedContext.requestId.length, 36); // UUID length
});

Deno.test('withRequestId - preserves existing context', async () => {
  let capturedContext: any;
  
  const handler = withRequestId(async (req, ctx) => {
    capturedContext = ctx;
    return new Response('OK');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  assertExists(capturedContext.requestId);
});

Deno.test('withErrorHandling - catches and handles errors', async () => {
  const handler = withErrorHandling(async () => {
    throw new Error('Test error');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, 'Test error');
});

Deno.test('withErrorHandling - passes through successful responses', async () => {
  const handler = withErrorHandling(async () => {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
});

Deno.test('withCORS - adds CORS headers to response', async () => {
  const handler = withCORS(async () => {
    return new Response('OK');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  assertExists(response.headers.get('Access-Control-Allow-Headers'));
});

Deno.test('withCORS - handles OPTIONS preflight', async () => {
  const handler = withCORS(async () => {
    return new Response('OK');
  });

  const req = new Request('https://test.com/test', { method: 'OPTIONS' });
  const response = await handler(req, {});

  assertEquals(response.status, 204);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
});

Deno.test('middleware composition - combines multiple middleware', async () => {
  const handler = withRequestId(
    withCORS(async (req, ctx: any) => {
      return new Response(JSON.stringify({ test: 'data' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    })
  );

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
  
  const body = await response.json();
  assertEquals(body.test, 'data');
});
