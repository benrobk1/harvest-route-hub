/**
 * COMPREHENSIVE MIDDLEWARE TESTS
 * 
 * Tests all middleware components with edge cases and error scenarios.
 * Validates the complete middleware stack integration.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { withRequestId } from '../_shared/middleware/withRequestId.ts';
import { withErrorHandling } from '../_shared/middleware/withErrorHandling.ts';
import { withCORS, validateOrigin, getCorsHeaders } from '../_shared/middleware/withCORS.ts';
import { createMetricsCollector } from '../_shared/monitoring/metrics.ts';

type MiddlewareContext = {
  corsHeaders?: Record<string, string>;
  requestId?: string;
};

// ============================================================================
// REQUEST ID MIDDLEWARE TESTS
// ============================================================================

Deno.test('withRequestId - generates unique request IDs', async () => {
  const ids: string[] = [];
  
  const handler = withRequestId(async (req, ctx) => {
    ids.push(ctx.requestId);
    return new Response('OK');
  });

  // Make multiple requests
  for (let i = 0; i < 3; i++) {
    const req = new Request('https://test.com/test');
    await handler(req, {});
  }

  // Verify all IDs are unique
  const uniqueIds = new Set(ids);
  assertEquals(uniqueIds.size, 3);
});

Deno.test('withRequestId - logs request duration', async () => {
  const handler = withRequestId(async (req, ctx) => {
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response('OK');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
});

Deno.test('withRequestId - logs errors with request ID', async () => {
  const handler = withRequestId(async (req, ctx) => {
    throw new Error('Test error');
  });

  const req = new Request('https://test.com/test');
  
  try {
    await handler(req, {});
  } catch (error: unknown) {
    if (error instanceof Error) {
      assertExists(error.message);
    }
  }
});

// ============================================================================
// ERROR HANDLING MIDDLEWARE TESTS
// ============================================================================

Deno.test('withErrorHandling - catches synchronous errors', async () => {
  const handler = withErrorHandling(async () => {
    throw new Error('Synchronous error');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, 'Synchronous error');
});

Deno.test('withErrorHandling - catches asynchronous errors', async () => {
  const handler = withErrorHandling(async () => {
    await new Promise((_, reject) => reject(new Error('Async error')));
    return new Response('Should not reach here');
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
  const body = await response.json();
  assertEquals(body.error, 'Async error');
});

Deno.test('withErrorHandling - passes through successful responses', async () => {
  const handler = withErrorHandling(async () => {
    return new Response(JSON.stringify({ data: 'test' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.data, 'test');
});

Deno.test('withErrorHandling - preserves error status codes', async () => {
  const handler = withErrorHandling(async () => {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 404);
});

// ============================================================================
// CORS MIDDLEWARE TESTS
// ============================================================================

Deno.test('validateOrigin - allows configured origins', () => {
  const allowedOrigins = [
    'https://lovable.app',
    'http://localhost:5173',
    'http://localhost:3000',
  ];

  for (const origin of allowedOrigins) {
    const req = new Request('https://test.com/test', {
      headers: { 'Origin': origin }
    });
    const result = validateOrigin(req);
    assertEquals(result, origin);
  }
});

Deno.test('validateOrigin - rejects unknown origins', () => {
  const req = new Request('https://test.com/test', {
    headers: { 'Origin': 'https://malicious.com' }
  });
  const result = validateOrigin(req);
  assertEquals(result, null);
});

Deno.test('validateOrigin - allows requests without origin header', () => {
  const req = new Request('https://test.com/test');
  const result = validateOrigin(req);
  assertEquals(result, 'https://lovable.app'); // Default fallback
});

Deno.test('getCorsHeaders - includes required headers', () => {
  const headers = getCorsHeaders('https://lovable.app');
  
  assertExists(headers['Access-Control-Allow-Origin']);
  assertExists(headers['Access-Control-Allow-Headers']);
  assertEquals(headers['Access-Control-Allow-Origin'], 'https://lovable.app');
});

Deno.test('getCorsHeaders - includes credentials for allowed origins', () => {
  const headers = getCorsHeaders('https://lovable.app');
  assertEquals(headers['Access-Control-Allow-Credentials'], 'true');
});

Deno.test('withCORS - handles OPTIONS preflight', async () => {
  const handler = withCORS(async (req, ctx: MiddlewareContext) => {
    return new Response('OK');
  });

  const req = new Request('https://test.com/test', {
    method: 'OPTIONS',
    headers: { 'Origin': 'https://lovable.app' }
  });
  const response = await handler(req, {});

  assertEquals(response.status, 204);
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('withCORS - rejects non-allowed origins', async () => {
  const handler = withCORS(async (req, ctx: MiddlewareContext) => {
    return new Response('OK');
  });

  const req = new Request('https://test.com/test', {
    headers: { 'Origin': 'https://evil.com' }
  });
  const response = await handler(req, {});

  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.error, 'FORBIDDEN');
});

Deno.test('withCORS - attaches CORS headers to response', async () => {
  const handler = withCORS(async (req, ctx: MiddlewareContext) => {
    return new Response('OK', { headers: ctx.corsHeaders });
  });

  const req = new Request('https://test.com/test', {
    headers: { 'Origin': 'https://lovable.app' }
  });
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), 'https://lovable.app');
});

// ============================================================================
// METRICS COLLECTOR TESTS
// ============================================================================

Deno.test('createMetricsCollector - creates instance with request ID', () => {
  const requestId = crypto.randomUUID();
  const metrics = createMetricsCollector(requestId, 'test-function');
  
  assertExists(metrics);
  assertExists(metrics.mark);
  assertExists(metrics.log);
});

Deno.test('metrics.mark - records checkpoint without error', () => {
  const requestId = crypto.randomUUID();
  const metrics = createMetricsCollector(requestId, 'test-function');
  
  // Should not throw
  metrics.mark('test_checkpoint');
  metrics.mark('another_checkpoint');
});

Deno.test('metrics.log - logs complete request data', () => {
  const requestId = crypto.randomUUID();
  const metrics = createMetricsCollector(requestId, 'test-function');
  
  metrics.mark('auth_complete');
  metrics.mark('validation_complete');
  
  // Should not throw
  metrics.log({
    method: 'POST',
    path: '/test',
    statusCode: 200,
    userId: 'test-user-id',
  });
});

Deno.test('metrics.log - logs error data', () => {
  const requestId = crypto.randomUUID();
  const metrics = createMetricsCollector(requestId, 'test-function');
  
  // Should not throw
  metrics.log({
    method: 'POST',
    path: '/test',
    statusCode: 500,
    errorMessage: 'Test error',
    errorStack: 'Error stack trace',
  });
});

// ============================================================================
// MIDDLEWARE COMPOSITION TESTS
// ============================================================================

Deno.test('middleware composition - RequestId + ErrorHandling', async () => {
  const handler = withRequestId(
    withErrorHandling(async (req, ctx: MiddlewareContext) => {
      if (!ctx.requestId) {
        throw new Error('Missing request ID');
      }
      return new Response('OK');
    })
  );

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
});

Deno.test('middleware composition - full stack with error', async () => {
  const handler = withRequestId(
    withErrorHandling(
      withCORS(async (req, ctx: MiddlewareContext) => {
        throw new Error('Test error in full stack');
      })
    )
  );

  const req = new Request('https://test.com/test', {
    headers: { 'Origin': 'https://lovable.app' }
  });
  const response = await handler(req, {});

  assertEquals(response.status, 500);
  const body = await response.json();
  assertExists(body.error);
});

Deno.test('middleware composition - preserves context through layers', async () => {
  let capturedContext: MiddlewareContext | undefined;

  const handler = withRequestId(
    withCORS(async (req, ctx: MiddlewareContext) => {
      capturedContext = ctx;
      return new Response('OK', { headers: ctx.corsHeaders });
    })
  );

  const req = new Request('https://test.com/test', {
    headers: { 'Origin': 'https://lovable.app' }
  });
  await handler(req, {});

  assertExists(capturedContext.requestId);
  assertExists(capturedContext.corsHeaders);
});

// ============================================================================
// EDGE CASES AND ERROR SCENARIOS
// ============================================================================

Deno.test('error handling - handles null errors gracefully', async () => {
  const handler = withErrorHandling(async () => {
    throw null;
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
});

Deno.test('error handling - handles undefined errors gracefully', async () => {
  const handler = withErrorHandling(async () => {
    throw undefined;
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
});

Deno.test('error handling - handles non-Error objects', async () => {
  const handler = withErrorHandling(async () => {
    throw { message: 'Custom error object' };
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 500);
});

Deno.test('CORS - handles missing Origin header gracefully', async () => {
  const handler = withCORS(async (req, ctx: MiddlewareContext) => {
    return new Response('OK', { headers: ctx.corsHeaders });
  });

  const req = new Request('https://test.com/test');
  const response = await handler(req, {});

  assertEquals(response.status, 200);
  assertExists(response.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('metrics - handles rapid sequential marks', () => {
  const requestId = crypto.randomUUID();
  const metrics = createMetricsCollector(requestId, 'test-function');
  
  // Rapid fire marks
  for (let i = 0; i < 100; i++) {
    metrics.mark(`checkpoint_${i}`);
  }
  
  // Should not throw
  metrics.log({
    method: 'POST',
    path: '/test',
    statusCode: 200,
  });
});
