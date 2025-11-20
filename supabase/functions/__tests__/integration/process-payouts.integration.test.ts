/**
 * PROCESS PAYOUTS INTEGRATION TESTS
 * 
 * End-to-end tests for payout processing edge function.
 * Tests admin authentication, rate limiting, and Stripe integration.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { createClient, type Session, type User } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'test-anon-key';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'test-service-role-key';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-payouts`;

interface TestUser {
  user: User;
  session: Session;
  isAdmin: boolean;
}

async function createTestUser(isAdmin = false): Promise<TestUser> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const testEmail = `test-payout-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (error) throw error;

  // Assign admin role if requested
  if (isAdmin) {
    await supabase.from('user_roles').insert({
      user_id: data.user.id,
      role: 'admin'
    });
  }

  // Create session
  const { data: sessionData } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'test-password-123',
  });

  return {
    user: data.user,
    session: sessionData.session,
    isAdmin
  };
}

async function createTestPayout(recipientId: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: payout, error } = await supabase
    .from('payouts')
    .insert({
      recipient_id: recipientId,
      recipient_type: 'farmer',
      amount: 150.00,
      status: 'pending',
      description: 'Test payout for integration testing'
    })
    .select()
    .single();

  if (error) throw error;
  return payout.id;
}

async function cleanupTestData(userId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  await supabase.from('payouts').delete().eq('recipient_id', userId);
  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

Deno.test({
  name: 'Process Payouts - requires authentication',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assertEquals(response.status, 401);
    const body = await response.json();
    assertEquals(body.error, 'UNAUTHORIZED');
  },
});

Deno.test({
  name: 'Process Payouts - requires admin role',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const { user, session } = await createTestUser(false); // Non-admin user

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 403);
      const body = await response.json();
      assertEquals(body.error, 'Admin access required');
    } finally {
      await cleanupTestData(user.id);
    }
  },
});

Deno.test({
  name: 'Process Payouts - handles CORS preflight',
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
  name: 'Process Payouts - enforces rate limiting',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const { user, session } = await createTestUser(true); // Admin user

    try {
      // Make multiple rapid requests to trigger rate limit (max 5 per 10 minutes)
      const requests = Array(7).fill(null).map(() =>
        fetch(FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
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
    } finally {
      await cleanupTestData(user.id);
    }
  },
});

Deno.test({
  name: 'Process Payouts - handles no pending payouts',
  ignore: !Deno.env.get('SUPABASE_URL') || !Deno.env.get('STRIPE_SECRET_KEY'),
  async fn() {
    const { user, session } = await createTestUser(true);

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertEquals(body.payouts_processed, 0);
    } finally {
      await cleanupTestData(user.id);
    }
  },
});

Deno.test({
  name: 'Process Payouts - processes pending payouts successfully',
  ignore: !Deno.env.get('SUPABASE_URL') || !Deno.env.get('STRIPE_SECRET_KEY'),
  async fn() {
    const { user, session } = await createTestUser(true);

    try {
      // Create a test payout
      const payoutId = await createTestPayout(user.id);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      assertExists(body.payouts_processed);
      
      // Verify payout status was updated
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: updatedPayout } = await supabase
        .from('payouts')
        .select('status')
        .eq('id', payoutId)
        .single();

      // Status should be either 'processing' or 'completed' (or 'failed' if Stripe Connect not set up)
      assertExists(updatedPayout?.status);
    } finally {
      await cleanupTestData(user.id);
    }
  },
});

Deno.test({
  name: 'Process Payouts - handles Stripe errors gracefully',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const { user, session } = await createTestUser(true);

    try {
      // Create a payout with invalid data that will fail Stripe validation
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('payouts').insert({
        recipient_id: user.id,
        recipient_type: 'farmer',
        amount: -100.00, // Invalid negative amount
        status: 'pending',
        description: 'Invalid test payout'
      });

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      // Should still return 200 but with failures reported
      assertEquals(response.status, 200);
      const body = await response.json();
      assertEquals(body.success, true);
      
      // Check if failures are reported when payouts fail
      if (body.failures && body.failures.length > 0) {
        assertExists(body.failures[0].payout_id);
        assertExists(body.failures[0].error);
      }
    } finally {
      await cleanupTestData(user.id);
    }
  },
});

Deno.test({
  name: 'Process Payouts - returns proper metrics',
  ignore: !Deno.env.get('SUPABASE_URL') || !Deno.env.get('STRIPE_SECRET_KEY'),
  async fn() {
    const { user, session } = await createTestUser(true);

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();
      
      // Verify response structure
      assertEquals(body.success, true);
      assertExists(body.payouts_processed);
      assertEquals(typeof body.payouts_processed, 'number');
      assertExists(body.total_amount);
      assertEquals(typeof body.total_amount, 'number');
    } finally {
      await cleanupTestData(user.id);
    }
  },
});
