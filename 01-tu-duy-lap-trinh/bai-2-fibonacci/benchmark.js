const { fibonacci } = require('./fibonacci');

// Configuration constants
const WARMUP_RUNS = 1000;
const NUM_RUNS = 10;
const TEST_CASES = [10, 20, 50];

/**
 * Measure execution time with JIT warm-up and compute average over multiple runs.
 */
function benchmark(n, runs = NUM_RUNS, warmup = WARMUP_RUNS) {
  // Warm-up phase to trigger V8 JIT optimization
  for (let i = 0; i < warmup; i++) {
    fibonacci(n);
  }

  // Single execution timed with console.time after warm-up
  console.time(`  [console.time] F(${n})`);
  const result = fibonacci(n);
  console.timeEnd(`  [console.time] F(${n})`);

  // Measure average over runs using high-resolution timer
  const times = [];
  for (let i = 0; i < runs; i++) {
    const start = process.hrtime.bigint();
    fibonacci(n);
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // Convert nanoseconds to milliseconds
  }

  const avgTime = times.reduce((sum, t) => sum + t, 0) / runs;
  return { result, avgTime };
}

console.log('=== FIBONACCI BENCHMARK & VERIFICATION ===\n');

TEST_CASES.forEach((n) => {
  const { result, avgTime } = benchmark(n, NUM_RUNS);
  console.log(`• F(${n}) = ${result.toString()} (BigInt)`);
  console.log(`• Average execution time (${NUM_RUNS} runs): ${avgTime.toFixed(6)} ms`);
  console.log(`• Status: ${avgTime < 1 ? 'PASS (< 1ms)' : 'FAIL'}\n`);
});
