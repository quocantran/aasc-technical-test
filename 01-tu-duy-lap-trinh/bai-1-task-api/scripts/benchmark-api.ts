import { performance } from 'node:perf_hooks';

// Configuration constants
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/v1/tasks`;
const REQUEST_COUNT = 100;
const LATENCY_THRESHOLD_MS = 200;

// Fetch tasks and measure response duration
async function fetchTasks(): Promise<{ statusCode: number; recordCount: number; durationMs: number }> {
  const start = performance.now();
  const response = await fetch(ENDPOINT, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
  const data = await response.json() as unknown[];
  const end = performance.now();

  return {
    statusCode: response.status,
    recordCount: Array.isArray(data) ? data.length : 0,
    durationMs: end - start,
  };
}

// Run latency benchmark across 100 requests
async function runBenchmark() {
  console.log('=== API LATENCY BENCHMARK: GET /tasks (100 RECORDS) ===');
  console.log(`Target Endpoint: ${ENDPOINT}`);
  console.log(`Total Requests: ${REQUEST_COUNT}`);
  console.log(`Required Threshold: < ${LATENCY_THRESHOLD_MS} ms\n`);

  // Verify server connection before running benchmark
  try {
    const initialCheck = await fetchTasks();
    if (initialCheck.statusCode !== 200) {
      throw new Error(`Endpoint returned HTTP status ${initialCheck.statusCode}`);
    }
    console.log(`Initial check passed: ${initialCheck.recordCount} records retrieved (HTTP 200).`);
  } catch (error: any) {
    console.error(`Unable to connect to server at ${ENDPOINT}. Ensure the server is running.`);
    console.error(`Error details: ${error.message}`);
    process.exit(1);
  }

  console.log('Sending requests...');
  const latencies: number[] = [];
  let returnedRecordCount = 0;

  for (let i = 1; i <= REQUEST_COUNT; i++) {
    const { durationMs, recordCount } = await fetchTasks();
    latencies.push(durationMs);
    returnedRecordCount = recordCount;
  }

  // Calculate statistical metrics
  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
  
  // Calculate P95 latency
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Index];

  const isPassed = p95Latency < LATENCY_THRESHOLD_MS && avgLatency < LATENCY_THRESHOLD_MS;

  console.log('\n=== BENCHMARK RESULTS (100 REQUESTS) ===');
  console.log(`• Records count in database : ${returnedRecordCount}`);
  console.log(`• Requests sent             : ${REQUEST_COUNT}`);
  console.log(`• Min latency               : ${minLatency.toFixed(2)} ms`);
  console.log(`• Average latency           : ${avgLatency.toFixed(2)} ms`);
  console.log(`• P95 latency               : ${p95Latency.toFixed(2)} ms`);
  console.log(`• Max latency               : ${maxLatency.toFixed(2)} ms`);
  console.log(`• Benchmark status (< 200ms): ${isPassed ? 'PASS' : 'FAIL'}`);
  console.log('========================================');
}

runBenchmark();
