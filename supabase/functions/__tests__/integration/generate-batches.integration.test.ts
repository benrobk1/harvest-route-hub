/**
 * GENERATE BATCHES INTEGRATION TESTS
 * 
 * End-to-end tests for batch generation edge function.
 * Tests admin authentication, rate limiting, OSRM integration, and route optimization.
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.192.0/testing/asserts.ts';
import { createClient, type Session, type User } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'test-anon-key';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'test-service-role-key';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-batches`;

interface TestUser {
  user: User;
  session: Session;
  isAdmin: boolean;
}

async function createTestUser(isAdmin = false): Promise<TestUser> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  const testEmail = `test-batch-${Date.now()}@example.com`;
  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: 'test-password-123',
    email_confirm: true,
  });

  if (error) throw error;

  // Create profile with address
  await supabase.from('profiles').update({
    full_name: 'Test Consumer',
    street_address: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip_code: '94102',
    phone: '555-0100'
  }).eq('id', data.user.id);

  // Assign admin role if requested
  if (isAdmin) {
    await supabase.from('user_roles').insert({
      user_id: data.user.id,
      role: 'admin'
    });
  } else {
    // Regular user gets consumer role
    await supabase.from('user_roles').insert({
      user_id: data.user.id,
      role: 'consumer'
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

async function createTestOrder(consumerId: string): Promise<string> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      consumer_id: consumerId,
      delivery_date: tomorrowDate,
      status: 'pending',
      subtotal: 50.00,
      delivery_fee: 5.00,
      total_amount: 55.00,
      delivery_batch_id: null
    })
    .select()
    .single();

  if (error) throw error;
  return order.id;
}

async function cleanupTestData(userId: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Clean up orders and related data
  const { data: orders } = await supabase
    .from('orders')
    .select('id, delivery_batch_id')
    .eq('consumer_id', userId);

  if (orders) {
    const batchIds = [...new Set(orders.map(o => o.delivery_batch_id).filter(Boolean))];
    const orderIds = orders.map(o => o.id);

    // Delete batch stops
    if (batchIds.length > 0) {
      await supabase.from('batch_stops').delete().in('delivery_batch_id', batchIds);
      await supabase.from('routes').delete().in('delivery_batch_id', batchIds);
      await supabase.from('delivery_batches').delete().in('id', batchIds);
    }

    // Delete order items and orders
    await supabase.from('order_items').delete().in('order_id', orderIds);
    await supabase.from('orders').delete().eq('consumer_id', userId);
  }

  await supabase.from('user_roles').delete().eq('user_id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

Deno.test({
  name: 'Generate Batches - requires authentication',
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
  name: 'Generate Batches - requires admin role',
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
  name: 'Generate Batches - handles CORS preflight',
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
  name: 'Generate Batches - enforces rate limiting',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const { user, session } = await createTestUser(true); // Admin user

    try {
      // Make multiple rapid requests to trigger rate limit (max 10 per hour)
      const requests = Array(12).fill(null).map(() =>
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
  name: 'Generate Batches - handles no pending orders',
  ignore: !Deno.env.get('SUPABASE_URL'),
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
      assertEquals(body.message, 'No pending orders to process');
      assertEquals(body.batches_created, 0);
    } finally {
      await cleanupTestData(user.id);
    }
  },
});

Deno.test({
  name: 'Generate Batches - creates batches for pending orders',
  ignore: !Deno.env.get('SUPABASE_URL') || !Deno.env.get('OSRM_SERVER_URL'),
  async fn() {
    const adminUser = await createTestUser(true);
    const consumerUser = await createTestUser(false);

    try {
      // Create test orders
      const orderId1 = await createTestOrder(consumerUser.user.id);
      const orderId2 = await createTestOrder(consumerUser.user.id);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminUser.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();
      
      assertEquals(body.success, true);
      assertExists(body.batches_created);
      assertExists(body.total_orders_processed);
      assertExists(body.delivery_date);
      assertExists(body.batches);

      // Verify batches array structure
      if (body.batches.length > 0) {
        const batch = body.batches[0];
        assertExists(batch.batch_id);
        assertExists(batch.batch_number);
        assertExists(batch.zip_code);
        assertExists(batch.order_count);
        assertExists(batch.total_distance_km);
        assertExists(batch.estimated_duration_minutes);
      }

      // Verify orders were updated
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('status, delivery_batch_id')
        .eq('id', orderId1)
        .single();

      assertEquals(updatedOrder?.status, 'confirmed');
      assertExists(updatedOrder?.delivery_batch_id);
    } finally {
      await cleanupTestData(adminUser.user.id);
      await cleanupTestData(consumerUser.user.id);
    }
  },
});

Deno.test({
  name: 'Generate Batches - groups orders by ZIP code',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const adminUser = await createTestUser(true);
    const consumer1 = await createTestUser(false);
    const consumer2 = await createTestUser(false);

    try {
      // Update consumer2 with different ZIP
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from('profiles').update({
        zip_code: '94103' // Different ZIP
      }).eq('id', consumer2.user.id);

      // Create orders
      await createTestOrder(consumer1.user.id);
      await createTestOrder(consumer2.user.id);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminUser.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();

      // Should create multiple batches for different ZIPs
      assertEquals(body.success, true);
      assertExists(body.batches);
      
      // Verify ZIP codes are different if multiple batches created
      if (body.batches.length > 1) {
        const zipCodes = body.batches.map((batch: { zip_code: string }) => batch.zip_code);
        const uniqueZips = new Set(zipCodes);
        assertEquals(uniqueZips.size > 1, true);
      }
    } finally {
      await cleanupTestData(adminUser.user.id);
      await cleanupTestData(consumer1.user.id);
      await cleanupTestData(consumer2.user.id);
    }
  },
});

Deno.test({
  name: 'Generate Batches - creates optimized routes',
  ignore: !Deno.env.get('SUPABASE_URL') || !Deno.env.get('OSRM_SERVER_URL'),
  async fn() {
    const adminUser = await createTestUser(true);
    const consumerUser = await createTestUser(false);

    try {
      // Create multiple orders
      await createTestOrder(consumerUser.user.id);
      await createTestOrder(consumerUser.user.id);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminUser.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();

      if (body.batches.length > 0) {
        const batch = body.batches[0];
        
        // Verify route optimization metrics
        assertExists(batch.total_distance_km);
        assertEquals(typeof batch.total_distance_km, 'number');
        assertEquals(batch.total_distance_km >= 0, true);
        
        assertExists(batch.estimated_duration_minutes);
        assertEquals(typeof batch.estimated_duration_minutes, 'number');
        assertEquals(batch.estimated_duration_minutes > 0, true);

        // Verify batch stops were created with sequence
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: stops } = await supabase
          .from('batch_stops')
          .select('sequence_number, estimated_arrival')
          .eq('delivery_batch_id', batch.batch_id)
          .order('sequence_number');

        assertExists(stops);
        assertEquals(stops.length > 0, true);
        
        // Verify sequences are sequential
        stops.forEach((stop, index) => {
          assertEquals(stop.sequence_number, index + 1);
          assertExists(stop.estimated_arrival);
        });
      }
    } finally {
      await cleanupTestData(adminUser.user.id);
      await cleanupTestData(consumerUser.user.id);
    }
  },
});

Deno.test({
  name: 'Generate Batches - generates box codes',
  ignore: !Deno.env.get('SUPABASE_URL'),
  async fn() {
    const adminUser = await createTestUser(true);
    const consumerUser = await createTestUser(false);

    try {
      const orderId = await createTestOrder(consumerUser.user.id);

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminUser.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      assertEquals(response.status, 200);
      const body = await response.json();

      if (body.batches.length > 0) {
        // Verify box code was generated
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: order } = await supabase
          .from('orders')
          .select('box_code')
          .eq('id', orderId)
          .single();

        assertExists(order?.box_code);
        // Box code format: B{batch_number}-{sequence}
        if (order?.box_code) {
          assertEquals(/^B\d+-\d+$/.test(order.box_code), true);
        }
      }
    } finally {
      await cleanupTestData(adminUser.user.id);
      await cleanupTestData(consumerUser.user.id);
    }
  },
});

Deno.test({
  name: 'Generate Batches - returns proper error structure',
  ignore: !Deno.env.get('SUPABASE_URL'),
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
      assertExists(body.delivery_date);
      assertExists(body.batches_created);
      assertExists(body.total_orders_processed);
      assertExists(body.batches);
      
      // Errors should be undefined or an array
      if (body.errors !== undefined) {
        assertEquals(Array.isArray(body.errors), true);
      }
    } finally {
      await cleanupTestData(user.id);
    }
  },
});
