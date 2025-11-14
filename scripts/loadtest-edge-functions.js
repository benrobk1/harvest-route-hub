/**
 * EDGE FUNCTION LOAD TESTING SUITE
 * 
 * Tests edge functions under various traffic patterns:
 * - Sustained load (baseline performance)
 * - Spike testing (sudden traffic increases)
 * - Stress testing (breaking point identification)
 * - Soak testing (memory leaks, resource exhaustion)
 * 
 * Usage:
 *   node scripts/loadtest-edge-functions.js --pattern=sustained --function=checkout
 *   node scripts/loadtest-edge-functions.js --pattern=spike --function=all
 *   node scripts/loadtest-edge-functions.js --pattern=stress --duration=300
 */

import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'loadtest@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value;
  return acc;
}, {});

const PATTERN = args.pattern || 'sustained'; // sustained, spike, stress, soak
const FUNCTION = args.function || 'checkout';
const DURATION = parseInt(args.duration || '60'); // seconds
const MAX_VUS = parseInt(args.maxvus || '100'); // virtual users

// Test results storage
const results = {
  pattern: PATTERN,
  function: FUNCTION,
  startTime: new Date().toISOString(),
  requests: [],
  summary: {
    total: 0,
    success: 0,
    failed: 0,
    avgDuration: 0,
    p50: 0,
    p95: 0,
    p99: 0,
    maxDuration: 0,
    minDuration: Infinity,
    errorsPerSecond: 0,
    requestsPerSecond: 0
  }
};

/**
 * Authentication helper
 */
async function authenticate() {
  console.log('🔐 Authenticating test user...');
  
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('✅ Authenticated successfully');
  return data.access_token;
}

/**
 * Test edge function with metrics
 */
async function testFunction(functionName, payload, token) {
  const start = Date.now();
  let success = false;
  let statusCode = 0;
  let error = null;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify(payload)
      }
    );

    statusCode = response.status;
    success = response.ok;

    if (!response.ok) {
      const errorText = await response.text();
      error = `${statusCode}: ${errorText.substring(0, 100)}`;
    }
  } catch (err) {
    error = err.message;
  }

  const duration = Date.now() - start;

  return {
    timestamp: new Date().toISOString(),
    duration,
    success,
    statusCode,
    error
  };
}

/**
 * Generate test payload based on function
 */
function generatePayload(functionName) {
  const payloads = {
    'checkout': {
      cartId: '00000000-0000-0000-0000-000000000001',
      deliveryDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      useCredits: false,
      tipAmount: 5.00,
      isDemoMode: true
    },
    'check-subscription': {},
    'generate-batches': {
      deliveryDate: new Date(Date.now() + 86400000).toISOString()
    },
    'get-metrics': {
      range: '1h'
    },
    'award-credits': {
      consumerId: '00000000-0000-0000-0000-000000000001',
      amount: 10.00,
      reason: 'Load test credit'
    }
  };

  return payloads[functionName] || {};
}

/**
 * SUSTAINED LOAD TEST
 * Baseline performance with constant load
 */
async function sustainedLoadTest(functionName, token, vus, duration) {
  console.log(`\n🔄 SUSTAINED LOAD TEST`);
  console.log(`Function: ${functionName}`);
  console.log(`Virtual Users: ${vus}`);
  console.log(`Duration: ${duration}s`);
  console.log('─'.repeat(60));

  const payload = generatePayload(functionName);
  const endTime = Date.now() + duration * 1000;
  const activeRequests = [];

  // Create virtual users
  for (let i = 0; i < vus; i++) {
    // Stagger start times slightly
    setTimeout(async () => {
      while (Date.now() < endTime) {
        const promise = testFunction(functionName, payload, token)
          .then(result => {
            results.requests.push(result);
            results.summary.total++;
            if (result.success) {
              results.summary.success++;
            } else {
              results.summary.failed++;
            }
          });
        
        activeRequests.push(promise);
        
        // Wait before next request (simulate real user behavior)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      }
    }, i * 100); // Stagger by 100ms
  }

  // Wait for duration
  await new Promise(resolve => setTimeout(resolve, duration * 1000));
  
  // Wait for remaining requests
  await Promise.all(activeRequests);
  
  console.log(`✅ Sustained load test complete: ${results.summary.total} requests`);
}

/**
 * SPIKE TEST
 * Sudden traffic increase simulation
 */
async function spikeTest(functionName, token, baselineVUs, spikeVUs, duration) {
  console.log(`\n⚡ SPIKE TEST`);
  console.log(`Function: ${functionName}`);
  console.log(`Baseline VUs: ${baselineVUs} → Spike: ${spikeVUs}`);
  console.log(`Duration: ${duration}s`);
  console.log('─'.repeat(60));

  const payload = generatePayload(functionName);
  const phases = [
    { vus: baselineVUs, duration: Math.floor(duration * 0.3) }, // 30% baseline
    { vus: spikeVUs, duration: Math.floor(duration * 0.4) },    // 40% spike
    { vus: baselineVUs, duration: Math.floor(duration * 0.3) }  // 30% cooldown
  ];

  for (const phase of phases) {
    console.log(`Phase: ${phase.vus} VUs for ${phase.duration}s`);
    await sustainedLoadTest(functionName, token, phase.vus, phase.duration);
  }

  console.log(`✅ Spike test complete`);
}

/**
 * STRESS TEST
 * Gradually increase load to find breaking point
 */
async function stressTest(functionName, token, maxVUs, duration) {
  console.log(`\n💪 STRESS TEST`);
  console.log(`Function: ${functionName}`);
  console.log(`Ramping up to: ${maxVUs} VUs`);
  console.log(`Duration: ${duration}s`);
  console.log('─'.repeat(60));

  const steps = 10;
  const stepDuration = Math.floor(duration / steps);
  const vusPerStep = Math.floor(maxVUs / steps);

  for (let step = 1; step <= steps; step++) {
    const currentVUs = vusPerStep * step;
    console.log(`Step ${step}/${steps}: ${currentVUs} VUs`);
    
    await sustainedLoadTest(functionName, token, currentVUs, stepDuration);
    
    // Check if error rate is too high (>10%)
    const errorRate = results.summary.failed / results.summary.total;
    if (errorRate > 0.1) {
      console.warn(`⚠️  High error rate detected: ${(errorRate * 100).toFixed(2)}%`);
      console.warn(`Breaking point reached at ${currentVUs} VUs`);
      break;
    }
  }

  console.log(`✅ Stress test complete`);
}

/**
 * SOAK TEST
 * Extended duration test for memory leaks and resource exhaustion
 */
async function soakTest(functionName, token, vus, duration) {
  console.log(`\n🛁 SOAK TEST (Memory Leak Detection)`);
  console.log(`Function: ${functionName}`);
  console.log(`Virtual Users: ${vus}`);
  console.log(`Duration: ${duration}s (${Math.floor(duration / 60)} minutes)`);
  console.log('─'.repeat(60));

  const checkpoints = 10;
  const checkpointInterval = Math.floor(duration / checkpoints);

  for (let i = 1; i <= checkpoints; i++) {
    console.log(`Checkpoint ${i}/${checkpoints}...`);
    
    const checkpointStart = results.summary.total;
    await sustainedLoadTest(functionName, token, vus, checkpointInterval);
    const checkpointEnd = results.summary.total;
    
    const checkpointRequests = results.requests.slice(checkpointStart, checkpointEnd);
    const avgDuration = checkpointRequests.reduce((sum, r) => sum + r.duration, 0) / checkpointRequests.length;
    
    console.log(`  Checkpoint ${i} avg duration: ${avgDuration.toFixed(0)}ms`);
    
    // Check for performance degradation
    if (i > 1) {
      const previousCheckpoint = results.requests.slice(
        checkpointStart - (checkpointEnd - checkpointStart),
        checkpointStart
      );
      const previousAvg = previousCheckpoint.reduce((sum, r) => sum + r.duration, 0) / previousCheckpoint.length;
      
      const degradation = ((avgDuration - previousAvg) / previousAvg) * 100;
      if (degradation > 20) {
        console.warn(`⚠️  Performance degradation detected: +${degradation.toFixed(2)}%`);
      }
    }
  }

  console.log(`✅ Soak test complete`);
}

/**
 * Calculate percentiles
 */
function calculatePercentile(arr, percentile) {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Generate test summary
 */
function generateSummary() {
  const durations = results.requests.map(r => r.duration);
  
  results.summary.avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  results.summary.p50 = calculatePercentile(durations, 0.50);
  results.summary.p95 = calculatePercentile(durations, 0.95);
  results.summary.p99 = calculatePercentile(durations, 0.99);
  results.summary.maxDuration = Math.max(...durations);
  results.summary.minDuration = Math.min(...durations);
  
  const testDuration = (new Date() - new Date(results.startTime)) / 1000;
  results.summary.requestsPerSecond = results.summary.total / testDuration;
  results.summary.errorsPerSecond = results.summary.failed / testDuration;
  
  results.endTime = new Date().toISOString();
  results.durationSeconds = testDuration;

  return results;
}

/**
 * Print results
 */
async function printResults() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('═'.repeat(60));
  console.log(`Pattern: ${results.pattern}`);
  console.log(`Function: ${results.function}`);
  console.log(`Duration: ${results.durationSeconds.toFixed(2)}s`);
  console.log('─'.repeat(60));
  console.log(`Total Requests: ${results.summary.total}`);
  console.log(`✅ Successful: ${results.summary.success} (${((results.summary.success / results.summary.total) * 100).toFixed(2)}%)`);
  console.log(`❌ Failed: ${results.summary.failed} (${((results.summary.failed / results.summary.total) * 100).toFixed(2)}%)`);
  console.log('─'.repeat(60));
  console.log(`Throughput: ${results.summary.requestsPerSecond.toFixed(2)} req/s`);
  console.log(`Error Rate: ${results.summary.errorsPerSecond.toFixed(2)} errors/s`);
  console.log('─'.repeat(60));
  console.log(`Avg Duration: ${results.summary.avgDuration.toFixed(0)}ms`);
  console.log(`P50: ${results.summary.p50.toFixed(0)}ms`);
  console.log(`P95: ${results.summary.p95.toFixed(0)}ms`);
  console.log(`P99: ${results.summary.p99.toFixed(0)}ms`);
  console.log(`Min: ${results.summary.minDuration.toFixed(0)}ms`);
  console.log(`Max: ${results.summary.maxDuration.toFixed(0)}ms`);
  console.log('═'.repeat(60));

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `loadtest-${results.pattern}-${results.function}-${timestamp}.json`;
  
  try {
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
  } catch (err) {
    console.error('Failed to save results:', err.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Edge Function Load Testing Suite');
  console.log('═'.repeat(60));

  try {
    // Authenticate
    const token = await authenticate();

    // Run selected pattern
    switch (PATTERN) {
      case 'sustained':
        await sustainedLoadTest(FUNCTION, token, MAX_VUS, DURATION);
        break;
      
      case 'spike':
        await spikeTest(FUNCTION, token, 10, MAX_VUS, DURATION);
        break;
      
      case 'stress':
        await stressTest(FUNCTION, token, MAX_VUS, DURATION);
        break;
      
      case 'soak':
        await soakTest(FUNCTION, token, 20, DURATION);
        break;
      
      default:
        throw new Error(`Unknown pattern: ${PATTERN}`);
    }

    // Generate and print results
    generateSummary();
    await printResults();

    // Exit with appropriate code
    const errorRate = results.summary.failed / results.summary.total;
    process.exit(errorRate > 0.05 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Load test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
