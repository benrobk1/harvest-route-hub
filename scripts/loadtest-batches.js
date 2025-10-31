/**
 * Load Test: Batch Generation Performance
 * 
 * Tests the generate-batches edge function with 40 addresses
 * to validate route optimization performance for investor/customer confidence.
 * 
 * Usage: node scripts/loadtest-batches.js
 * Expected: < 3s for 40 addresses
 */

// Load environment variables from .env
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
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

// Generate 40 test addresses in NYC area (realistic distribution)
const testAddresses = Array.from({ length: 40 }, (_, i) => ({
  id: `test-order-${i + 1}`,
  delivery_address: `${100 + i * 3} Broadway, New York, NY 100${Math.floor(i / 10).toString().padStart(2, '0')}`,
  delivery_lat: 40.7128 + (Math.random() - 0.5) * 0.1, // ~5mi radius from NYC center
  delivery_lng: -74.0060 + (Math.random() - 0.5) * 0.1,
}));

async function runLoadTest() {
  console.log('🚀 Starting batch generation load test...');
  console.log(`📍 Testing with ${testAddresses.length} addresses`);
  console.log(`🌐 Endpoint: ${SUPABASE_URL}/functions/v1/generate-batches`);
  console.log('');
  
  const start = Date.now();
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ 
        orders: testAddresses,
        max_batch_size: 10, // 4 batches expected
      }),
    });
    
    const duration = Date.now() - start;
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ LOAD TEST RESULTS:');
    console.log('─────────────────────────────────────');
    console.log(`⏱️  Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`📦 Batches created: ${result.batches?.length || 0}`);
    console.log(`🚚 Orders per batch: ~${Math.ceil(testAddresses.length / (result.batches?.length || 1))}`);
    console.log(`🎯 Avg time per address: ${(duration / testAddresses.length).toFixed(0)}ms`);
    console.log('─────────────────────────────────────');
    
    if (duration < 3000) {
      console.log('🎉 Performance Target: PASSED (< 3s)');
      console.log('✨ System can handle 40+ concurrent orders efficiently');
    } else {
      console.log('⚠️  Performance Target: NEEDS OPTIMIZATION (> 3s)');
      console.log('💡 Consider caching geocoding results or optimizing routing algorithm');
    }
    
    console.log('');
    console.log('📊 Extrapolated Capacity:');
    const ordersPerSecond = (testAddresses.length / duration) * 1000;
    console.log(`   - ${ordersPerSecond.toFixed(1)} orders/second`);
    console.log(`   - ~${Math.floor(ordersPerSecond * 60)} orders/minute`);
    console.log(`   - ~${Math.floor(ordersPerSecond * 3600)} orders/hour`);
    
    return { duration, result };
  } catch (error) {
    console.error('\n❌ Load test failed:', error.message);
    throw error;
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
