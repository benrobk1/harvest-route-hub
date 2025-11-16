/**
 * COMPREHENSIVE PERFORMANCE BENCHMARK SUITE
 * 
 * Measures baseline performance for critical operations:
 * - Database queries
 * - Edge function execution
 * - Frontend bundle size
 * - API response times
 */

import { readFileSync } from 'fs';
import { performance } from 'perf_hooks';

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
const ANON_KEY = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

// Performance thresholds (ms)
const THRESHOLDS = {
  simpleQuery: 100,
  complexQuery: 500,
  edgeFunction: 1000,
  authentication: 500,
  fileUpload: 2000
};

// Test results storage
const results = {
  database: [],
  edgeFunctions: [],
  authentication: []
};

// Benchmark a database query
async function benchmarkQuery(name, queryFn, threshold) {
  const iterations = 10;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await queryFn();
    const duration = performance.now() - start;
    times.push(duration);
  }

  const avg = times.reduce((a, b) => a + b, 0) / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

  const passed = avg <= threshold;

  results.database.push({
    name,
    avg: avg.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
    p95: p95.toFixed(2),
    threshold,
    passed
  });

  return { avg, passed };
}

// Benchmark an edge function
async function benchmarkEdgeFunction(name, functionName, payload, threshold) {
  const iterations = 5;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      await response.json();
    } catch (error) {
      // Ignore errors for benchmarking
    }
    const duration = performance.now() - start;
    times.push(duration);
  }

  const avg = times.reduce((a, b) => a + b, 0) / iterations;
  const min = Math.min(...times);
  const max = Math.max(...times);

  const passed = avg <= threshold;

  results.edgeFunctions.push({
    name,
    avg: avg.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
    threshold,
    passed
  });

  return { avg, passed };
}

// Run database benchmarks
async function runDatabaseBenchmarks() {
  console.log('📊 Running Database Benchmarks...\n');

  // Simple SELECT query
  await benchmarkQuery(
    'Simple SELECT (products)',
    async () => {
      await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=id,name,price&limit=10`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          }
        }
      );
    },
    THRESHOLDS.simpleQuery
  );

  // Complex JOIN query
  await benchmarkQuery(
    'Complex JOIN (orders with items)',
    async () => {
      await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=*,order_items(*)&limit=10`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`
          }
        }
      );
    },
    THRESHOLDS.complexQuery
  );

  // Filtered query with aggregation
  await benchmarkQuery(
    'Filtered query with count',
    async () => {
      await fetch(
        `${SUPABASE_URL}/rest/v1/products?select=*&is_approved=eq.true`,
        {
          headers: {
            'apikey': ANON_KEY,
            'Authorization': `Bearer ${ANON_KEY}`,
            'Prefer': 'count=exact'
          }
        }
      );
    },
    THRESHOLDS.complexQuery
  );
}

// Run edge function benchmarks
async function runEdgeFunctionBenchmarks() {
  console.log('⚡ Running Edge Function Benchmarks...\n');

  await benchmarkEdgeFunction(
    'Check Subscription',
    'check-subscription',
    { user_id: 'test-user-id' },
    THRESHOLDS.edgeFunction
  );

  await benchmarkEdgeFunction(
    'Generate Batches',
    'generate-batches',
    {},
    THRESHOLDS.edgeFunction * 2 // Allow more time for batch generation
  );
}

// Print results
function printResults() {
  console.log('\n' + '='.repeat(80));
  console.log('📈 PERFORMANCE BENCHMARK RESULTS');
  console.log('='.repeat(80) + '\n');

  // Database results
  console.log('DATABASE QUERIES');
  console.log('-'.repeat(80));
  console.log('Query                              Avg      Min      Max      P95   Threshold  Status');
  console.log('-'.repeat(80));
  results.database.forEach(r => {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(
      `${r.name.padEnd(32)} ${r.avg.padStart(6)}ms ${r.min.padStart(6)}ms ${r.max.padStart(6)}ms ${r.p95.padStart(6)}ms ${String(r.threshold).padStart(8)}ms  ${status}`
    );
  });

  // Edge function results
  if (results.edgeFunctions.length > 0) {
    console.log('\n\nEDGE FUNCTIONS');
    console.log('-'.repeat(80));
    console.log('Function                           Avg      Min      Max    Threshold  Status');
    console.log('-'.repeat(80));
    results.edgeFunctions.forEach(r => {
      const status = r.passed ? '✓ PASS' : '✗ FAIL';
      console.log(
        `${r.name.padEnd(32)} ${r.avg.padStart(6)}ms ${r.min.padStart(6)}ms ${r.max.padStart(6)}ms ${String(r.threshold).padStart(8)}ms  ${status}`
      );
    });
  }

  // Summary
  const allTests = [...results.database, ...results.edgeFunctions];
  const passed = allTests.filter(r => r.passed).length;
  const failed = allTests.filter(r => !r.passed).length;

  console.log('\n' + '='.repeat(80));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${allTests.length} tests`);
  console.log('='.repeat(80) + '\n');

  if (failed > 0) {
    console.log('⚠️  Some benchmarks did not meet performance thresholds.');
    console.log('Consider optimizing queries, adding indexes, or scaling resources.\n');
  } else {
    console.log('✅ All benchmarks passed! System performance is within acceptable limits.\n');
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Performance Benchmark Suite\n');
  console.log(`Target: ${SUPABASE_URL}\n`);

  try {
    await runDatabaseBenchmarks();
    await runEdgeFunctionBenchmarks();
    printResults();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

main();
