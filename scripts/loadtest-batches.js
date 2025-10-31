/**
 * Load Test: Batch Generation Performance
 * 
 * Tests the generate-batches edge function with 40 real database orders
 * to validate route optimization performance for investor/customer confidence.
 * 
 * Usage: node scripts/loadtest-batches.js
 * Expected: < 3s for 40 addresses
 * 
 * Requirements:
 * - SUPABASE_SERVICE_ROLE_KEY in .env (for database seeding and cleanup)
 */

const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.resolve(__dirname, '../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    envVars[key] = value;
  }
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (needed for test data seeding)');
  console.error('\n💡 Add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  process.exit(1);
}

// Simple Supabase client
const supabase = {
  from: (table) => {
    const builder = {
      select: (columns = '*') => {
        builder._select = columns;
        return builder;
      },
      insert: (data) => {
        builder._insert = data;
        builder._method = 'POST';
        return builder;
      },
      delete: () => {
        builder._method = 'DELETE';
        return builder;
      },
      eq: (column, value) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ column, op: 'eq', value });
        return builder;
      },
      in: (column, values) => {
        builder._filters = builder._filters || [];
        builder._filters.push({ column, op: 'in', value: values.join(',') });
        return builder;
      },
      single: () => {
        builder._single = true;
        return builder;
      },
      execute: async () => {
        let url = `${SUPABASE_URL}/rest/v1/${table}`;
        const headers = {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        };

        if (builder._filters) {
          const params = new URLSearchParams();
          builder._filters.forEach(f => {
            params.append(f.column, `${f.op}.${f.value}`);
          });
          url += '?' + params.toString();
        }

        if (builder._select) {
          url += (url.includes('?') ? '&' : '?') + `select=${builder._select}`;
        }

        const options = {
          method: builder._method || 'GET',
          headers
        };

        if (builder._insert) {
          options.body = JSON.stringify(builder._insert);
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
          return { data: null, error: data };
        }

        return { 
          data: builder._single ? data[0] : data, 
          error: null 
        };
      }
    };
    builder._table = table;
    return builder;
  },
  functions: {
    invoke: async (functionName, options = {}) => {
      const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options.body || {})
      });

      const data = await response.json();
      return { data, error: response.ok ? null : data };
    }
  }
};

// Test data generation
function generateTestAddresses(count = 40) {
  return Array.from({ length: count }, (_, i) => {
    const streetNum = 100 + (i * 3);
    const floor = Math.floor(i / 10);
    const zipCode = `100${floor.toString().padStart(2, '0')}`;
    const lat = 40.7128 + (Math.random() - 0.5) * 0.1;
    const lng = -74.0060 + (Math.random() - 0.5) * 0.1;
    
    return {
      street_address: `${streetNum} Broadway`,
      city: 'New York',
      state: 'NY',
      zip_code: zipCode,
      lat,
      lng
    };
  });
}

async function createTestConsumer() {
  const testEmail = `loadtest-${Date.now()}@test.com`;
  const testAddresses = generateTestAddresses(40);
  const primaryAddress = testAddresses[0];

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      email: testEmail,
      full_name: 'Load Test Consumer',
      street_address: primaryAddress.street_address,
      city: primaryAddress.city,
      state: primaryAddress.state,
      zip_code: primaryAddress.zip_code,
      phone: '555-0100',
      approval_status: 'approved'
    })
    .select()
    .single()
    .execute();

  if (error) {
    throw new Error(`Failed to create test consumer: ${JSON.stringify(error)}`);
  }

  return { consumerId: data.id, addresses: testAddresses };
}

async function seedTestOrders(consumerId, addresses) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const deliveryDate = tomorrow.toISOString().split('T')[0];

  const orderIds = [];

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const { data, error } = await supabase
      .from('orders')
      .insert({
        consumer_id: consumerId,
        delivery_date: deliveryDate,
        status: 'pending',
        total_amount: 50 + (i * 2),
        delivery_batch_id: null
      })
      .select()
      .single()
      .execute();

    if (error) {
      throw new Error(`Failed to create order ${i + 1}: ${JSON.stringify(error)}`);
    }

    orderIds.push(data.id);

    // Update profile with delivery address for this order
    await supabase
      .from('profiles')
      .update({
        street_address: addr.street_address,
        city: addr.city,
        state: addr.state,
        zip_code: addr.zip_code
      })
      .eq('id', consumerId)
      .execute();
  }

  return orderIds;
}

async function cleanup(consumerId, orderIds) {
  console.log('\n🧹 Cleaning up test data...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const deliveryDate = tomorrow.toISOString().split('T')[0];

  // Delete batch stops
  await supabase
    .from('batch_stops')
    .delete()
    .in('order_id', orderIds)
    .execute();

  // Delete delivery batches
  await supabase
    .from('delivery_batches')
    .delete()
    .eq('delivery_date', deliveryDate)
    .execute();

  // Delete orders
  await supabase
    .from('orders')
    .delete()
    .in('id', orderIds)
    .execute();

  // Delete user role
  await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', consumerId)
    .execute();

  // Delete profile
  await supabase
    .from('profiles')
    .delete()
    .eq('id', consumerId)
    .execute();

  console.log('✅ Cleanup complete');
}

async function runLoadTest() {
  console.log('🚀 Starting batch generation load test...');
  console.log('');

  let consumerId, orderIds;

  try {
    // Phase 1: Seed test data
    console.log('📊 Phase 1: Seeding test data...');
    const { consumerId: cid, addresses } = await createTestConsumer();
    consumerId = cid;
    console.log(`✅ Created test consumer: ${consumerId}`);

    orderIds = await seedTestOrders(consumerId, addresses);
    console.log(`✅ Created ${orderIds.length} test orders`);
    console.log('');

    // Phase 2: Run batch generation
    console.log('📦 Phase 2: Running batch generation...');
    const start = Date.now();

    const { data: result, error } = await supabase.functions.invoke('generate-batches');

    const duration = Date.now() - start;

    if (error) {
      throw new Error(`Batch generation failed: ${JSON.stringify(error)}`);
    }

    // Phase 3: Validate results
    console.log('');
    console.log('✅ LOAD TEST RESULTS:');
    console.log('─────────────────────────────────────');
    console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`📦 Batches created: ${result.batches?.length || 0}`);
    
    if (result.batches && result.batches.length > 0) {
      console.log(`🚚 Orders per batch: ~${Math.ceil(orderIds.length / result.batches.length)}`);
      console.log(`🎯 Avg time per address: ${(duration / orderIds.length).toFixed(0)}ms`);
    }
    
    console.log('─────────────────────────────────────');

    if (duration < 3000) {
      console.log('🎉 Performance Target: PASSED (< 3s)');
      console.log('✨ System can handle 40+ concurrent orders efficiently');
    } else {
      console.log('⚠️  Performance Target: NEEDS OPTIMIZATION (> 3s)');
      console.log('💡 Consider optimizing routing algorithm or database queries');
    }

    console.log('');
    console.log('📊 Extrapolated Capacity:');
    const ordersPerSecond = (orderIds.length / duration) * 1000;
    console.log(`   - ${ordersPerSecond.toFixed(1)} orders/second`);
    console.log(`   - ~${Math.floor(ordersPerSecond * 60)} orders/minute`);
    console.log(`   - ~${Math.floor(ordersPerSecond * 3600)} orders/hour`);

    if (result.batches && result.batches.length > 0) {
      console.log('');
      console.log('📍 Batch Details:');
      result.batches.forEach((batch, i) => {
        console.log(`   - Batch ${i + 1}: ${batch.stops?.length || 0} stops`);
      });
    }

    return { duration, result };
  } catch (error) {
    console.error('\n❌ Load test failed:', error.message);
    throw error;
  } finally {
    if (consumerId && orderIds) {
      await cleanup(consumerId, orderIds);
    }
  }
}

// Run test
console.log('');
runLoadTest()
  .then(() => {
    console.log('');
    process.exit(0);
  })
  .catch(() => {
    console.log('');
    process.exit(1);
  });
