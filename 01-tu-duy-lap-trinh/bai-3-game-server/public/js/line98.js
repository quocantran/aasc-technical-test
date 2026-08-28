// Line 98 Canvas Game Engine
let socket = null;
let currentGameId = null;
let board = Array.from({ length: 9 }, () => Array(9).fill(0));
let score = 0;
let nextBalls = [];
let selectedCell = null; // { row, col }
let hintMove = null;     // { from: {row, col}, to: {row, col} }
let isAnimating = false;

// Color Definitions
const BALL_COLORS = {
  1: { base: '#f43f5e', dark: '#9f1239', glow: 'rgba(244, 63, 94, 0.6)' },   // Ruby Red
  2: { base: '#10b981', dark: '#065f46', glow: 'rgba(16, 185, 129, 0.6)' },  // Emerald
  3: { base: '#3b82f6', dark: '#1e40af', glow: 'rgba(59, 130, 246, 0.6)' },  // Sapphire Blue
  4: { base: '#f59e0b', dark: '#92400e', glow: 'rgba(245, 158, 11, 0.6)' },  // Amber Gold
  5: { base: '#a855f7', dark: '#6b21a8', glow: 'rgba(168, 85, 247, 0.6)' },  // Amethyst Purple
};

// Canvas references
const canvas = document.getElementById('line98-canvas');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 9;
const CELL_SIZE = canvas.width / GRID_SIZE; // 60px

// Particle system for line clears
let particles = [];

// Audio Synthesizer
class SoundFx {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }
  select() { this.playTone(520, 'sine', 0.08, 0.1); }
  move() { this.playTone(440, 'triangle', 0.12, 0.15); }
  clear() {
    this.playTone(659, 'sine', 0.15, 0.2);
    setTimeout(() => this.playTone(880, 'sine', 0.25, 0.2), 100);
    setTimeout(() => this.playTone(1046, 'sine', 0.35, 0.2), 200);
  }
  error() { this.playTone(180, 'sawtooth', 0.2, 0.2); }
}
const sfx = new SoundFx();

// Initialize Game
document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  socket = createGameSocket('/line98');
  if (!socket) return;

  setupSocketListeners();
  setupCanvasEvents();

  // Start initial render loop
  requestAnimationFrame(renderLoop);
});

function setupSocketListeners() {
  socket.on('connect', () => {
    startNewGame();
  });

  socket.on('gameCreated', (data) => {
    currentGameId = data.gameId;
    board = data.board;
    score = data.score;
    nextBalls = data.nextBalls;
    selectedCell = null;
    hintMove = null;
    updateUI();
    showToast('Bắt đầu ván mới! Chúc bạn may mắn!', 'success');
  });

  socket.on('gameState', async (data) => {
    currentGameId = data.gameId;
    selectedCell = null;
    hintMove = null;

    if (data.path && data.path.length > 1) {
      isAnimating = true;
      await animateMovePath(data.path, data.board, data.clearedCells);
    }

    const prevScore = score;
    board = data.board;
    score = data.score;
    nextBalls = data.nextBalls;
    isAnimating = false;
    updateUI();

    const pointsAdded = score - prevScore;
    if (pointsAdded > 0) {
      sfx.clear();
      if (data.clearedCells && data.clearedCells.length > 0) {
        spawnClearParticles(data.clearedCells);
      }
      showToast(`+${pointsAdded} điểm!`, 'success');
    } else {
      sfx.move();
    }

    if (data.status === 'gameover') {
      document.getElementById('final-score').innerText = score;
      document.getElementById('game-over-modal').classList.add('active');
    }
  });

  socket.on('hintResult', (data) => {
    hintMove = data;
    selectedCell = data.from;
    sfx.select();
    showToast('Đã gợi ý nước đi! Di chuyển bóng được chọn tới ô màu xanh.', 'info');
  });

  socket.on('error', (err) => {
    sfx.error();
    showToast(err.message || 'Thao tác không thành công', 'error');
    isAnimating = false;
  });
}

function startNewGame() {
  if (!socket) return;
  socket.emit('createGame', {}, (res) => {
    if (res && res.data) {
      currentGameId = res.data.gameId;
      board = res.data.board;
      score = res.data.score;
      nextBalls = res.data.nextBalls;
      updateUI();
    }
  });
}

function restartFromModal() {
  document.getElementById('game-over-modal').classList.remove('active');
  startNewGame();
}

function requestHint() {
  if (!socket || !currentGameId || isAnimating) return;
  socket.emit('getHint', { gameId: currentGameId }, (res) => {
    if (res && res.data) {
      hintMove = res.data;
      selectedCell = res.data.from;
      sfx.select();
    }
  });
}

function updateUI() {
  document.getElementById('score-val').innerText = score;
  const container = document.getElementById('next-balls-preview');
  container.innerHTML = '';

  nextBalls.forEach((color) => {
    const ballEl = document.createElement('div');
    ballEl.className = 'next-ball';
    const c = BALL_COLORS[color] || { base: '#555' };
    ballEl.style.background = `radial-gradient(circle at 35% 35%, #fff 0%, ${c.base} 40%, ${c.dark || '#000'} 100%)`;
    ballEl.style.boxShadow = `0 0 10px ${c.glow || 'rgba(0,0,0,0.5)'}`;
    container.appendChild(ballEl);
  });
}

function setupCanvasEvents() {
  canvas.addEventListener('click', (e) => {
    if (isAnimating) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;

    const clickedColor = board[row][col];

    if (clickedColor !== 0) {
      // Select ball
      selectedCell = { row, col };
      hintMove = null;
      sfx.select();
    } else if (selectedCell) {
      // Attempt move from selectedCell to { row, col }
      isAnimating = true;
      socket.emit(
        'moveBall',
        {
          gameId: currentGameId,
          from: selectedCell,
          to: { row, col },
        },
        (res) => {
          if (res && res.event === 'error') {
            isAnimating = false;
            sfx.error();
            showToast(res.data.message, 'error');
          }
        },
      );
    }
  });
}

// Path animation
async function animateMovePath(path, targetBoard, clearedCells) {
  if (!path || path.length < 2) {
    isAnimating = false;
    return;
  }

  const start = path[0];
  const end = path[path.length - 1];
  const ballColor =
    (board[start.row] && board[start.row][start.col]) ||
    (targetBoard && targetBoard[end.row] ? targetBoard[end.row][end.col] : 1);

  if (board[start.row]) {
    board[start.row][start.col] = 0; // Temporarily clear start cell so it doesn't double-render
  }

  const durationPerSegment = 50; // ms per grid cell

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const startTime = performance.now();
    await new Promise((resolve) => {
      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / durationPerSegment);

        // Interpolated position along current segment
        movingBall = {
          x: (from.col + (to.col - from.col) * progress) * CELL_SIZE + CELL_SIZE / 2,
          y: (from.row + (to.row - from.row) * progress) * CELL_SIZE + CELL_SIZE / 2,
          color: ballColor,
        };

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  }

  movingBall = null;
  isAnimating = false;
}

let movingBall = null;

// Particle effect on line clear
function spawnClearParticles(cells) {
  cells.forEach((pos) => {
    const colorVal = board[pos.row][pos.col] || 1;
    const color = BALL_COLORS[colorVal]?.base || '#fff';
    const cx = pos.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = pos.row * CELL_SIZE + CELL_SIZE / 2;

    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        alpha: 1,
        color,
      });
    }
  });
}

// Main Render Loop
let pulseTimer = 0;
function renderLoop(timestamp) {
  pulseTimer += 0.05;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Grid
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const x = c * CELL_SIZE;
      const y = r * CELL_SIZE;

      // Cell background
      ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // Cell border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

      // Hint target highlight
      if (hintMove && hintMove.to.row === r && hintMove.to.col === c) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }

      // Selected cell highlight
      if (selectedCell && selectedCell.row === r && selectedCell.col === c) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }

      // Draw Ball
      const ball = board[r][c];
      if (ball !== 0) {
        const isSelected = selectedCell && selectedCell.row === r && selectedCell.col === c;
        const scale = isSelected ? 1 + Math.sin(pulseTimer * 3) * 0.12 : 1;
        drawBall(x + CELL_SIZE / 2, y + CELL_SIZE / 2, ball, scale, isSelected);
      }
    }
  }

  // 2. Draw Moving Ball (if path animating)
  if (movingBall) {
    drawBall(movingBall.x, movingBall.y, movingBall.color, 1.1, true);
  }

  // 3. Update & Draw Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025;
    p.size = Math.max(0.1, p.size - 0.05);

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  requestAnimationFrame(renderLoop);
}

function drawBall(cx, cy, colorVal, scale = 1, glowing = false) {
  const c = BALL_COLORS[colorVal];
  if (!c) return;

  const radius = (CELL_SIZE / 2 - 8) * scale;

  ctx.save();

  // Glow if selected
  if (glowing) {
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 16;
  }

  // Radial 3D sphere gradient
  const grad = ctx.createRadialGradient(
    cx - radius * 0.35,
    cy - radius * 0.35,
    radius * 0.1,
    cx,
    cy,
    radius,
  );
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, c.base);
  grad.addColorStop(1, c.dark);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
