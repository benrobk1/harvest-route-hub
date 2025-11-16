/**
 * CHECKOUT INTEGRATION TESTS
 * 
 * End-to-end tests for checkout edge function.
 * Tests full middleware stack, validation, and business logic.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'test-anon-key';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/checkout`;

async function createTestUser() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const testEmail = `test-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.signUp({
    email: testEmail,
    password: 'test-password-123',
  });

  if (error) throw error;
  return data;
}

async function createTestCart(userId: string, token: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data: cart, error } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return cart;
}

Deno.test({
  name: 'Checkout - requires authentication',
  ignore: !Deno.env.get('SUPABASE_URL'), // Skip if no Supabase configured
  async fn() {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart_id: 'test-cart-id',
        delivery_date: new Date().toISOString(),
      }),
    });

    assertEquals(response.status, 401);
    const body = await response.json();
    assertEquals(body.error, 'UNAUTHORIZED');
  },
});

Deno.test({
  name: 'Checkout - validates request schema',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const { session } = await createTestUser();
    if (!session) throw new Error('Failed to create test user');

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing required fields
        cart_id: 'not-a-uuid',
      }),
    });

    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, 'VALIDATION_ERROR');
    assertExists(body.details);
  },
});

Deno.test({
  name: 'Checkout - handles CORS preflight',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const response = await fetch(FUNCTION_URL, {
      method: 'OPTIONS',
    });

    assertEquals(response.status, 204);
    assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
    assertExists(response.headers.get('Access-Control-Allow-Headers'));
  },
});

Deno.test({
  name: 'Checkout - enforces rate limiting',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const { session } = await createTestUser();
    if (!session) throw new Error('Failed to create test user');

    const cart = await createTestCart(session.user.id, session.access_token);

    // Make multiple rapid requests to trigger rate limit
    const requests = Array(12).fill(null).map(() =>
      fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cart_id: cart.id,
          delivery_date: new Date().toISOString(),
        }),
      })
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);

    // At least one should be rate limited
    assertEquals(rateLimitedResponses.length > 0, true);
    
    if (rateLimitedResponses.length > 0) {
      const body = await rateLimitedResponses[0].json();
      assertEquals(body.error, 'TOO_MANY_REQUESTS');
      assertExists(body.retryAfter);
    }
  },
});
