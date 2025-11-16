/**
 * CHECKOUT PERFORMANCE LOAD TEST
 * 
 * Simulates high-volume checkout scenarios to test:
 * - Concurrent checkout requests
 * - Payment processing under load
 * - Stripe integration performance
 * - Database transaction handling
 * 
 * Target: < 3s response time for 95th percentile under 50 concurrent users
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';

// Load environment variables
const envFile = readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Mock Supabase client
const createClient = () => ({
  from: (table) => {
    let query = { table };
    return {
      select: (columns = '*') => {
        query.columns = columns;
        return {
          eq: (column, value) => {
            query.eq = { column, value };
            return {
              single: async () => {
                const response = await fetch(
                  `${SUPABASE_URL}/rest/v1/${query.table}?${query.eq.column}=eq.${query.eq.value}&select=${query.columns}`,
                  {
                    headers: {
                      'apikey': SERVICE_ROLE_KEY,
                      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=representation'
                    }
                  }
                );
                const data = await response.json();
                return { data: data[0] || null, error: null };
              },
              execute: async () => {
                const response = await fetch(
                  `${SUPABASE_URL}/rest/v1/${query.table}?${query.eq.column}=eq.${query.eq.value}&select=${query.columns}`,
                  {
                    headers: {
                      'apikey': SERVICE_ROLE_KEY,
                      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                      'Content-Type': 'application/json'
                    }
                  }
                );
                const data = await response.json();
                return { data, error: null };
              }
            };
          },
          execute: async () => {
            const response = await fetch(
              `${SUPABASE_URL}/rest/v1/${query.table}?select=${query.columns}`,
              {
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            const data = await response.json();
            return { data, error: null };
          }
        };
      },
      insert: (data) => ({
        select: () => ({
          single: async () => {
            const response = await fetch(
              `${SUPABASE_URL}/rest/v1/${query.table}`,
              {
                method: 'POST',
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify(data)
              }
            );
            const result = await response.json();
            return { data: result[0] || result, error: null };
          }
        })
      }),
      delete: () => ({
        eq: (column, value) => ({
          execute: async () => {
            await fetch(
              `${SUPABASE_URL}/rest/v1/${query.table}?${column}=eq.${value}`,
              {
                method: 'DELETE',
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                }
              }
            );
            return { data: null, error: null };
          }
        }),
        in: (column, values) => ({
          execute: async () => {
            await fetch(
              `${SUPABASE_URL}/rest/v1/${query.table}?${column}=in.(${values.join(',')})`,
              {
                method: 'DELETE',
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                }
              }
            );
            return { data: null, error: null };
          }
        })
      })
    };
  },
  functions: {
    invoke: async (name, options) => {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/${name}`,
        {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(options?.body || {})
        }
      );
      const data = await response.json();
      return { data, error: null };
    }
  }
});

const supabase = createClient();

// Test configuration
const TEST_CONFIG = {
  concurrentUsers: 50,
  ordersPerUser: 2,
  targetResponseTime: 3000, // 3 seconds
  acceptableFailureRate: 0.05 // 5%
};

// Create test consumer
async function createTestConsumer() {
  const email = `loadtest-${Date.now()}@test.com`;
  const { data: profile } = await supabase
    .from('profiles')
    .insert({
      email,
      full_name: 'Load Test Consumer',
      phone: '555-0100',
      primary_address: '123 Test St, Test City, TC 12345',
      role: 'consumer'
    })
    .select()
    .single();

  await supabase
    .from('user_roles')
    .insert({ user_id: profile.id, role: 'consumer' });

  return profile;
}

// Create test products
async function createTestProducts(farmerId, count = 5) {
  const products = [];
  for (let i = 0; i < count; i++) {
    const { data: product } = await supabase
      .from('products')
      .insert({
        farmer_id: farmerId,
        name: `Load Test Product ${i}`,
        price: 10 + i,
        unit: 'lb',
        available_quantity: 100,
        category: 'vegetables',
        is_approved: true
      })
      .select()
      .single();
    products.push(product);
  }
  return products;
}

// Simulate checkout
async function simulateCheckout(consumerId, products) {
  const cartItems = products.slice(0, 3).map(p => ({
    product_id: p.id,
    quantity: Math.floor(Math.random() * 3) + 1
  }));

  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.functions.invoke('checkout', {
      body: {
        consumer_id: consumerId,
        cart_items: cartItems,
        delivery_address: '123 Test St, Test City, TC 12345',
        delivery_instructions: 'Load test order'
      }
    });

    const duration = Date.now() - startTime;

    if (error) {
      return { success: false, duration, error };
    }

    return { success: true, duration, orderId: data.order_id };
  } catch (error) {
    const duration = Date.now() - startTime;
    return { success: false, duration, error: error.message };
  }
}

// Run load test
async function runLoadTest() {
  console.log('🚀 Starting Checkout Load Test\n');
  console.log(`Configuration:`);
  console.log(`- Concurrent users: ${TEST_CONFIG.concurrentUsers}`);
  console.log(`- Orders per user: ${TEST_CONFIG.ordersPerUser}`);
  console.log(`- Target response time: ${TEST_CONFIG.targetResponseTime}ms`);
  console.log(`- Total orders: ${TEST_CONFIG.concurrentUsers * TEST_CONFIG.ordersPerUser}\n`);

  let testData = { consumerIds: [], productIds: [] };

  try {
    // Setup: Create test farmer and products
    console.log('📦 Setting up test data...');
    const { data: farmer } = await supabase
      .from('profiles')
      .insert({
        email: `loadtest-farmer-${Date.now()}@test.com`,
        full_name: 'Load Test Farmer',
        role: 'farmer'
      })
      .select()
      .single();

    const products = await createTestProducts(farmer.id, 10);
    testData.productIds = products.map(p => p.id);

    // Create test consumers
    console.log('👥 Creating test consumers...');
    const consumers = await Promise.all(
      Array.from({ length: TEST_CONFIG.concurrentUsers }, () => createTestConsumer())
    );
    testData.consumerIds = consumers.map(c => c.id);

    // Run concurrent checkouts
    console.log('🔥 Starting concurrent checkouts...\n');
    const startTime = Date.now();

    const allCheckouts = [];
    for (const consumer of consumers) {
      for (let i = 0; i < TEST_CONFIG.ordersPerUser; i++) {
        allCheckouts.push(simulateCheckout(consumer.id, products));
      }
    }

    const results = await Promise.all(allCheckouts);
    const totalDuration = Date.now() - startTime;

    // Analyze results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];
    const maxDuration = Math.max(...durations);

    const throughput = (results.length / totalDuration) * 1000;
    const failureRate = failed.length / results.length;

    // Print results
    console.log('📊 Load Test Results\n');
    console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`Total Requests: ${results.length}`);
    console.log(`Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failed.length} (${(failureRate * 100).toFixed(1)}%)`);
    console.log(`\nResponse Times:`);
    console.log(`- Average: ${avgDuration.toFixed(0)}ms`);
    console.log(`- 50th percentile: ${p50.toFixed(0)}ms`);
    console.log(`- 95th percentile: ${p95.toFixed(0)}ms`);
    console.log(`- 99th percentile: ${p99.toFixed(0)}ms`);
    console.log(`- Max: ${maxDuration.toFixed(0)}ms`);
    console.log(`\nThroughput: ${throughput.toFixed(2)} requests/second\n`);

    // Evaluate performance
    const meetsTarget = p95 <= TEST_CONFIG.targetResponseTime;
    const acceptableFailures = failureRate <= TEST_CONFIG.acceptableFailureRate;

    console.log('✅ Performance Evaluation:');
    console.log(`${meetsTarget ? '✓' : '✗'} 95th percentile < ${TEST_CONFIG.targetResponseTime}ms: ${meetsTarget ? 'PASS' : 'FAIL'}`);
    console.log(`${acceptableFailures ? '✓' : '✗'} Failure rate < ${(TEST_CONFIG.acceptableFailureRate * 100).toFixed(0)}%: ${acceptableFailures ? 'PASS' : 'FAIL'}`);

    if (failed.length > 0) {
      console.log('\n❌ Sample Errors:');
      failed.slice(0, 3).forEach((f, i) => {
        console.log(`${i + 1}. ${f.error || 'Unknown error'}`);
      });
    }

  } catch (error) {
    console.error('💥 Load test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    if (testData.consumerIds.length > 0) {
      await supabase.from('user_roles').delete().in('user_id', testData.consumerIds).execute();
      await supabase.from('profiles').delete().in('id', testData.consumerIds).execute();
    }
    
    if (testData.productIds.length > 0) {
      await supabase.from('products').delete().in('id', testData.productIds).execute();
    }

    console.log('✓ Cleanup complete');
  }
}

// Run the test
runLoadTest().catch(console.error);
