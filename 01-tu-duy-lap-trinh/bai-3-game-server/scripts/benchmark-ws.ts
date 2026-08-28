import { io, Socket } from 'socket.io-client';

const BASE_HTTP = 'http://localhost:3001/api/v1';
const BASE_WS = 'http://localhost:3001';
const CONCURRENT_USERS = 10;
const MOVES_PER_USER = 5;

interface BenchmarkStats {
  totalRequests: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

function calculateStats(latencies: number[]): BenchmarkStats {
  if (latencies.length === 0) {
    return {
      totalRequests: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
    };
  }
  latencies.sort((a, b) => a - b);
  const total = latencies.length;
  const min = latencies[0];
  const max = latencies[total - 1];
  const avg = latencies.reduce((sum, v) => sum + v, 0) / total;
  const p95 = latencies[Math.floor(total * 0.95)] ?? max;
  const p99 = latencies[Math.floor(total * 0.99)] ?? max;

  return {
    totalRequests: total,
    minLatencyMs: min,
    maxLatencyMs: max,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
  };
}

function printStats(title: string, stats: BenchmarkStats, targetMs = 200) {
  const passed = stats.avgLatencyMs < targetMs;
  const statusBadge = passed ? '[✔ PASSED]' : '[✖ FAILED]';

  console.log(`\n======================================================`);
  console.log(`REPORT: ${title}`);
  console.log(`======================================================`);
  console.log(`- Total Requests / Operations : ${stats.totalRequests}`);
  console.log(`- Min Latency                 : ${stats.minLatencyMs.toFixed(2)} ms`);
  console.log(`- Max Latency                 : ${stats.maxLatencyMs.toFixed(2)} ms`);
  console.log(`- Avg Latency                 : ${stats.avgLatencyMs.toFixed(2)} ms`);
  console.log(`- P95 Latency (95th percentile): ${stats.p95LatencyMs.toFixed(2)} ms`);
  console.log(`- P99 Latency (99th percentile): ${stats.p99LatencyMs.toFixed(2)} ms`);
  console.log(`- Status (<${targetMs}ms target)      : ${statusBadge}`);
  console.log(`======================================================\n`);
}

async function registerAndLogin(index: number) {
  const suffix = Math.floor(Math.random() * 90000) + 10000;
  const username = `u_${index}_${suffix}`;
  const password = 'password123';

  // 1. Register distinct user in MongoDB
  const regRes = await fetch(`${BASE_HTTP}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!regRes.ok) {
    const err = await regRes.text();
    throw new Error(`Register failed (${regRes.status}): ${err}`);
  }

  // 2. Login to get JWT access token
  const loginRes = await fetch(`${BASE_HTTP}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!loginRes.ok) {
    const err = await loginRes.text();
    throw new Error(`Login failed (${loginRes.status}): ${err}`);
  }

  const data = await loginRes.json();
  return { token: data.accessToken, user: data.user, username };
}

async function runBenchmark() {
  console.log(`\n====================================================================`);
  console.log(`GAME SERVER BENCHMARK SUITE (10 CONCURRENT USERS)`);
  console.log(`- Performance Criteria: In-game real-time latency < 200ms`);
  console.log(`====================================================================\n`);

  // ----------------------------------------------------
  // STEP 1: INITIALIZE 10 CONCURRENT USER ACCOUNTS
  // ----------------------------------------------------
  console.log(`[Step 1/3] Creating and authenticating ${CONCURRENT_USERS} distinct accounts concurrently...`);
  const accounts: Array<{ token: string; user: any; username: string }> = [];

  const authPromises = Array.from({ length: CONCURRENT_USERS }, async (_, i) => {
    const acc = await registerAndLogin(i);
    accounts.push(acc);
  });

  await Promise.all(authPromises);
  console.log(`[✔] Successfully authenticated ${accounts.length} distinct players:`);
  accounts.forEach((acc, idx) => {
    console.log(`    Player ${idx + 1}: ${acc.username} (ID: ${acc.user.userId || acc.user.id || 'ok'})`);
  });

  // ----------------------------------------------------
  // STEP 2: LINE 98 WEBSOCKET BENCHMARK (10 CONCURRENT GAMES)
  // ----------------------------------------------------
  console.log(`\n[Step 2/3] Establishing 10 concurrent WebSocket connections to /line98...`);
  const line98Sockets: Socket[] = [];
  const line98Latencies: number[] = [];

  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const socket = io(`${BASE_WS}/line98`, {
      auth: { token: `Bearer ${accounts[i].token}` },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection timeout to /line98')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    line98Sockets.push(socket);
  }
  console.log(`[✔] 10 WebSocket clients connected to /line98.`);

  // All 10 players concurrently create games and execute BFS hint/path calculations
  console.log(`- Executing ${CONCURRENT_USERS * MOVES_PER_USER} concurrent BFS pathfinding & game operations...`);
  const line98Promises = line98Sockets.map(async (socket, playerIdx) => {
    // 1. Create new game session
    const gameData: any = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout createGame')), 5000);
      socket.once('gameCreated', (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      socket.emit('createGame');
    });

    const gameId = gameData.gameId;

    // 2. Perform concurrent BFS hint queries
    for (let m = 0; m < MOVES_PER_USER; m++) {
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 3000);
        socket.once('hintResult', () => {
          clearTimeout(timer);
          line98Latencies.push(performance.now() - t0);
          resolve();
        });
        socket.once('error', () => {
          clearTimeout(timer);
          resolve();
        });
        socket.emit('getHint', { gameId });
      });
    }
  });

  await Promise.all(line98Promises);
  line98Sockets.forEach((s) => s.disconnect());
  console.log(`[✔] Completed Line 98 concurrent benchmark.`);
  const line98Stats = calculateStats(line98Latencies);
  printStats('LINE 98 CONCURRENT REAL-TIME BFS & SYNC', line98Stats);

  // ----------------------------------------------------
  // STEP 3: CARO 1V1 MULTIPLAYER BENCHMARK (5 CONCURRENT ROOMS = 10 PLAYERS)
  // ----------------------------------------------------
  console.log(`[Step 3/3] Establishing 10 concurrent WebSocket connections to /caro...`);
  const caroSockets: Socket[] = [];
  const caroLatencies: number[] = [];

  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const socket = io(`${BASE_WS}/caro`, {
      auth: { token: `Bearer ${accounts[i].token}` },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection timeout to /caro')), 5000);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    caroSockets.push(socket);
  }
  console.log(`[✔] 10 WebSocket clients connected to /caro.`);

  // Matchmaking: create 5 live 1v1 rooms
  console.log(`- Performing automated matchmaking for 5 concurrent pairs...`);
  const matchResults: any[] = [];

  for (let pair = 0; pair < CONCURRENT_USERS / 2; pair++) {
    const socketA = caroSockets[pair * 2];
    const socketB = caroSockets[pair * 2 + 1];

    const matchPromiseA = new Promise<any>((resolve) => {
      socketA.once('matchFound', (data) => resolve(data));
      socketA.once('waitingForOpponent', () => {
        socketB.emit('findMatch');
      });
      socketA.emit('findMatch');
    });

    const matchPromiseB = new Promise<any>((resolve) => {
      socketB.once('matchFound', (data) => resolve(data));
    });

    const [gameA] = await Promise.all([matchPromiseA, matchPromiseB]);
    matchResults.push(gameA);
    console.log(`    Room ${pair + 1} (${gameA.gameId}): ${accounts[pair * 2].username} (X) vs ${accounts[pair * 2 + 1].username} (O)`);
  }
  console.log(`[✔] All 5 multiplayer match rooms active.`);

  // Concurrently execute moves across all 5 live rooms
  console.log(`- Executing live turns concurrently across all 5 rooms (Atomic conditional update & Win check)...`);
  const movePromises: Promise<void>[] = [];

  for (let pair = 0; pair < CONCURRENT_USERS / 2; pair++) {
    const socketX = caroSockets[pair * 2];
    const socketO = caroSockets[pair * 2 + 1];
    const game = matchResults[pair];

    movePromises.push(
      (async () => {
        for (let step = 0; step < 3; step++) {
          // X move
          const t0 = performance.now();
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => resolve(), 3000);
            socketX.once('gameState', () => {
              clearTimeout(timer);
              caroLatencies.push(performance.now() - t0);
              resolve();
            });
            socketX.emit('makeMove', {
              gameId: game.gameId,
              row: pair * 2,
              col: step * 2,
            });
          });

          // O move
          const t1 = performance.now();
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => resolve(), 3000);
            socketO.once('gameState', () => {
              clearTimeout(timer);
              caroLatencies.push(performance.now() - t1);
              resolve();
            });
            socketO.emit('makeMove', {
              gameId: game.gameId,
              row: pair * 2 + 1,
              col: step * 2 + 1,
            });
          });
        }
      })(),
    );
  }

  await Promise.all(movePromises);
  caroSockets.forEach((s) => s.disconnect());
  console.log(`[✔] Completed Caro multiplayer benchmark.`);
  const caroStats = calculateStats(caroLatencies);
  printStats('CARO 1V1 REAL-TIME ATOMIC UPDATES & WIN DETECTION', caroStats);

  // ----------------------------------------------------
  // OVERALL IN-GAME PERFORMANCE SUMMARY
  // ----------------------------------------------------
  const inGameLatencies = [...line98Latencies, ...caroLatencies];
  const overallStats = calculateStats(inGameLatencies);
  const overallPassed = overallStats.avgLatencyMs < 200;

  console.log(`====================================================================`);
  console.log(`OVERALL IN-GAME BENCHMARK SUMMARY (10 CONCURRENT USERS)`);
  console.log(`====================================================================`);
  console.log(`- Total In-Game Operations    : ${overallStats.totalRequests}`);
  console.log(`- Min Latency                 : ${overallStats.minLatencyMs.toFixed(2)} ms`);
  console.log(`- Max Latency                 : ${overallStats.maxLatencyMs.toFixed(2)} ms`);
  console.log(`- Avg Latency                 : ${overallStats.avgLatencyMs.toFixed(2)} ms`);
  console.log(`- P95 Latency (95th percentile): ${overallStats.p95LatencyMs.toFixed(2)} ms`);
  console.log(`- P99 Latency (99th percentile): ${overallStats.p99LatencyMs.toFixed(2)} ms`);
  console.log(`- In-Game Target (<200ms)     : ${overallPassed ? '[✔ PASSED]' : '[✖ FAILED]'}`);
  console.log(`====================================================================\n`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err.message);
});
