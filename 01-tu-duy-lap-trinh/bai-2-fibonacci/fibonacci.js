/**
 * Calculate the n-th Fibonacci number using Dynamic Programming (Bottom-Up).
 * Time Complexity: O(n) | Space Complexity: O(1)
 */
function fibonacci(n) {
  // Validate non-negative integer input
  if (typeof n !== 'number' || n < 0 || !Number.isInteger(n)) {
    throw new Error('Input must be a non-negative integer.');
  }

  // Base cases: F(0) = 0, F(1) = 1
  if (n === 0) return 0n;
  if (n === 1) return 1n;

  // Use BigInt to prevent integer overflow for large numbers
  let prev2 = 0n;
  let prev1 = 1n;
  let current = 0n;

  // Iterate from 2 to n to compute F(n)
  for (let i = 2; i <= n; i++) {
    current = prev1 + prev2;
    prev2 = prev1;
    prev1 = current;
  }

  return current;
}

module.exports = { fibonacci };
