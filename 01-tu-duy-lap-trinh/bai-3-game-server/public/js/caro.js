// Caro 15x15 Realtime Engine
let socket = null;
let currentGame = null;
let mySymbol = null; // 'X' or 'O'
let winningLine = [];
let hoverCell = null;
let isSendingMove = false; // Debounce lock for moves

// Canvas Setup
const canvas = document.getElementById('caro-canvas');
const ctx = canvas.getContext('2d');
const GRID_SIZE = 15;
const CELL_SIZE = canvas.width / GRID_SIZE; // 36px

// Sound FX Synthesizer
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
  move() { this.playTone(600, 'sine', 0.08, 0.12); }
  match() {
    this.playTone(523, 'triangle', 0.15, 0.2);
    setTimeout(() => this.playTone(659, 'triangle', 0.15, 0.2), 120);
    setTimeout(() => this.playTone(784, 'triangle', 0.25, 0.2), 240);
  }
  win() {
    this.playTone(523, 'sine', 0.15, 0.25);
    setTimeout(() => this.playTone(659, 'sine', 0.15, 0.25), 150);
    setTimeout(() => this.playTone(784, 'sine', 0.15, 0.25), 300);
    setTimeout(() => this.playTone(1046, 'sine', 0.4, 0.25), 450);
  }
  loss() {
    this.playTone(392, 'sawtooth', 0.2, 0.2);
    setTimeout(() => this.playTone(330, 'sawtooth', 0.3, 0.2), 180);
    setTimeout(() => this.playTone(261, 'sawtooth', 0.5, 0.2), 360);
  }
}
const sfx = new SoundFx();

document.addEventListener('DOMContentLoaded', () => {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  socket = createGameSocket('/caro');
  if (!socket) return;

  setupSocketListeners();
  setupCanvasEvents();
  loadMatchHistory();

  requestAnimationFrame(renderLoop);
});

function setupSocketListeners() {
  socket.on('waitingForOpponent', (data) => {
    mySymbol = 'X';
    document.getElementById('match-status-text').innerText = '⏳ Đang tìm kiếm đối thủ...';
    document.getElementById('btn-find-match').style.display = 'none';
    document.getElementById('btn-cancel-match').style.display = 'inline-block';

    const currentUser = getUser();
    const myName = currentUser ? (currentUser.nickname || currentUser.username) : 'Bạn';
    document.getElementById('name-player-x').innerText = `${myName} (Bạn)`;
    document.getElementById('name-player-o').innerText = 'Đang đợi đối thủ...';
  });

  socket.on('matchFound', (data) => {
    currentGame = data;
    const currentUser = getUser();

    mySymbol = data.playerX.userId === currentUser.userId ? 'X' : 'O';
    winningLine = [];

    document.getElementById('btn-cancel-match').style.display = 'none';
    const btnFind = document.getElementById('btn-find-match');
    btnFind.style.display = 'inline-block';
    btnFind.disabled = true;
    btnFind.innerText = 'Đang thi đấu';
    btnFind.classList.remove('btn-amber');
    btnFind.classList.add('btn-secondary');

    updatePlayersUI();
    sfx.match();
    showToast(`Đã tìm thấy đối thủ! Bạn là quân ${mySymbol}`, 'success');
  });

  socket.on('matchCancelled', (data) => {
    resetToReadyState();
    showToast(data.message || 'Đã hủy tìm trận', 'info');
  });

  socket.on('gameState', (data) => {
    isSendingMove = false;
    if (currentGame) {
      currentGame.board = data.board;
      currentGame.currentTurn = data.currentTurn;
      currentGame.lastMove = data.lastMove;
      currentGame.status = data.status;
      updateTurnUI();
      sfx.move();
    }
  });

  socket.on('gameOver', (data) => {
    const currentUser = getUser();
    const isWinner = data.winner === currentUser.userId;
    const isDraw = data.winner === 'draw';

    if (data.winningLine) {
      winningLine = data.winningLine;
    }

    if (currentGame) {
      currentGame.status = 'finished';
    }

    const modal = document.getElementById('caro-modal');
    const modalIcon = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');

    if (isWinner) {
      sfx.win();
      modalIcon.innerText = '🏆';
      modalTitle.innerText = 'Chiến Thắng!';
      modalTitle.style.color = 'var(--accent-emerald)';
      modalDesc.innerText = data.reason === 'opponent_disconnected'
        ? 'Đối thủ mất kết nối! Bạn được xử thắng.'
        : 'Bạn đã nối liền 5 quân cờ! Trận đấu xuất sắc!';
    } else if (isDraw) {
      modalIcon.innerText = '🤝';
      modalTitle.innerText = 'Hòa cờ!';
      modalTitle.style.color = 'var(--text-muted)';
      modalDesc.innerText = 'Bàn cờ đã đầy mà không có người chiến thắng.';
    } else {
      sfx.loss();
      modalIcon.innerText = '💀';
      modalTitle.innerText = 'Thất Bại';
      modalTitle.style.color = 'var(--accent-rose)';
      modalDesc.innerText = `${data.winnerName || 'Đối thủ'} đã nối liền 5 quân cờ trước.`;
    }

    modal.classList.add('active');
    loadMatchHistory();
  });

  socket.on('opponentDisconnected', (data) => {
    isSendingMove = false;
    showToast(`Đối thủ đã mất kết nối! Chiến thắng thuộc về bạn.`, 'info');
  });

  socket.on('error', () => {
    isSendingMove = false;
  });
}

function findMatch() {
  if (!socket) return;
  winningLine = [];
  currentGame = null;
  document.getElementById('btn-find-match').style.display = 'none';
  document.getElementById('btn-cancel-match').style.display = 'inline-block';
  document.getElementById('match-status-text').innerText = '⏳ Đang tìm kiếm đối thủ...';
  socket.emit('findMatch');
}

function cancelFindMatch() {
  if (!socket) return;
  socket.emit('cancelFindMatch');
  resetToReadyState();
}

function resetToReadyState() {
  document.getElementById('btn-cancel-match').style.display = 'none';
  const btnFind = document.getElementById('btn-find-match');
  btnFind.style.display = 'inline-block';
  btnFind.disabled = false;
  btnFind.innerText = '⚔️ Tìm trận';
  btnFind.classList.add('btn-amber');
  btnFind.classList.remove('btn-secondary');
  document.getElementById('match-status-text').innerText = 'Sẵn sàng thi đấu. Bấm "Tìm trận" để bắt đầu.';

  currentGame = null;
  mySymbol = null;
  winningLine = [];
  hoverCell = null;
  isSendingMove = false;

  const currentUser = getUser();
  const myName = currentUser ? (currentUser.nickname || currentUser.username) : 'Bạn';
  document.getElementById('name-player-x').innerText = `${myName} (Sẵn sàng)`;
  document.getElementById('name-player-o').innerText = 'Đối thủ (Đang chờ)';
  document.getElementById('turn-badge-x').style.display = 'none';
  document.getElementById('turn-badge-o').style.display = 'none';
}

function closeCaroModal() {
  document.getElementById('caro-modal').classList.remove('active');
  resetToReadyState();
}

function updatePlayersUI() {
  if (!currentGame) return;

  const currentUser = getUser();
  const xName = currentGame.playerX.nickname || currentGame.playerX.username;
  const oName = currentGame.playerO ? (currentGame.playerO.nickname || currentGame.playerO.username) : 'Đang chờ...';

  document.getElementById('name-player-x').innerText =
    currentGame.playerX.userId === currentUser.userId ? `${xName} (Bạn)` : xName;

  document.getElementById('name-player-o').innerText =
    currentGame.playerO && currentGame.playerO.userId === currentUser.userId ? `${oName} (Bạn)` : oName;

  updateTurnUI();
}

function updateTurnUI() {
  if (!currentGame) return;

  const turn = currentGame.currentTurn;
  const isMyTurn = mySymbol === turn;

  const badgeX = document.getElementById('turn-badge-x');
  const badgeO = document.getElementById('turn-badge-o');
  const statusText = document.getElementById('match-status-text');

  if (turn === 'X') {
    badgeX.style.display = 'inline-block';
    badgeO.style.display = 'none';
  } else {
    badgeO.style.display = 'inline-block';
    badgeX.style.display = 'none';
  }

  if (currentGame.status === 'playing') {
    if (isMyTurn) {
      statusText.innerHTML = `<span style="color:var(--accent-emerald);font-weight:700;">🟢 LƯỢT CỦA BẠN (${mySymbol})</span> — Hãy đặt quân cờ lên bàn!`;
    } else {
      statusText.innerHTML = `<span style="color:var(--text-muted);">⏳ Lượt của đối thủ (${turn})...</span>`;
    }
  }
}

async function loadMatchHistory() {
  try {
    const list = await apiFetch('/caro/history?limit=10');
    const container = document.getElementById('history-list');

    if (!list || list.length === 0) {
      container.innerHTML = `<div style="color: var(--text-sub); font-size: 0.85rem; text-align: center; padding: 1rem;">Chưa có lịch sử đấu nào.</div>`;
      return;
    }

    const currentUser = getUser();
    container.innerHTML = list
      .map((m) => {
        const isWon = m.winner === currentUser.userId;
        const isDraw = m.winner === 'draw';
        const opponentName = m.playerX.userId === currentUser.userId
          ? (m.playerO?.nickname || m.playerO?.username || 'Đối thủ')
          : (m.playerX?.nickname || m.playerX?.username || 'Đối thủ');

        const statusClass = isWon ? 'history-won' : isDraw ? 'history-draw' : 'history-lost';
        const statusText = isWon ? 'THẮNG' : isDraw ? 'HÒA' : 'THUA';

        return `
          <div class="history-item">
            <div>
              <span style="font-weight:600;">vs ${opponentName}</span>
              <span style="font-size:0.75rem;color:var(--text-sub);display:block;">${m.totalMoves} nước • ${m.durationSeconds}s</span>
            </div>
            <span class="${statusClass}">${statusText}</span>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Failed to load match history:', err);
  }
}

function setupCanvasEvents() {
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
      hoverCell = { row, col };
    } else {
      hoverCell = null;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hoverCell = null;
  });

  canvas.addEventListener('click', () => {
    if (!currentGame || currentGame.status !== 'playing' || !hoverCell || isSendingMove) return;
    if (currentGame.currentTurn !== mySymbol) {
      showToast('Chưa đến lượt của bạn!', 'error');
      return;
    }

    const moveRow = hoverCell.row;
    const moveCol = hoverCell.col;

    if (
      !currentGame.board ||
      !currentGame.board[moveRow] ||
      currentGame.board[moveRow][moveCol] !== 0
    ) {
      showToast('Ô này đã có quân cờ', 'error');
      return;
    }

    // Set sending lock & Send move to server
    isSendingMove = true;
    socket.emit('makeMove', {
      gameId: currentGame.gameId,
      row: moveRow,
      col: moveCol,
    });
  });
}

function renderLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Gomoku Grid
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < GRID_SIZE; i++) {
    // Horizontal line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CELL_SIZE / 2, i * CELL_SIZE + CELL_SIZE / 2);
    ctx.lineTo(canvas.width - CELL_SIZE / 2, i * CELL_SIZE + CELL_SIZE / 2);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2);
    ctx.lineTo(i * CELL_SIZE + CELL_SIZE / 2, canvas.height - CELL_SIZE / 2);
    ctx.stroke();
  }

  // Star Points at (3,3), (3,11), (7,7), (11,3), (11,11)
  const starPoints = [
    { r: 3, c: 3 },
    { r: 3, c: 11 },
    { r: 7, c: 7 },
    { r: 11, c: 3 },
    { r: 11, c: 11 },
  ];
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  starPoints.forEach((p) => {
    ctx.beginPath();
    ctx.arc(
      p.c * CELL_SIZE + CELL_SIZE / 2,
      p.r * CELL_SIZE + CELL_SIZE / 2,
      3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });

  // 2. Draw Hover Preview if empty and my turn
  if (
    hoverCell &&
    currentGame &&
    currentGame.status === 'playing' &&
    currentGame.currentTurn === mySymbol &&
    Array.isArray(currentGame.board) &&
    currentGame.board[hoverCell.row] &&
    currentGame.board[hoverCell.row][hoverCell.col] === 0
  ) {
    const cx = hoverCell.col * CELL_SIZE + CELL_SIZE / 2;
    const cy = hoverCell.row * CELL_SIZE + CELL_SIZE / 2;

    ctx.save();
    ctx.globalAlpha = 0.35;
    if (mySymbol === 'X') {
      drawPieceX(cx, cy);
    } else {
      drawPieceO(cx, cy);
    }
    ctx.restore();
  }

  // 3. Draw Placed Pieces (X and O)
  if (currentGame && Array.isArray(currentGame.board)) {
    for (let r = 0; r < GRID_SIZE; r++) {
      if (!currentGame.board[r]) continue;
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = currentGame.board[r][c];
        if (val !== 0) {
          const cx = c * CELL_SIZE + CELL_SIZE / 2;
          const cy = r * CELL_SIZE + CELL_SIZE / 2;

          const isLastMove =
            currentGame.lastMove &&
            currentGame.lastMove.row === r &&
            currentGame.lastMove.col === c;

          if (val === 1) {
            drawPieceX(cx, cy, isLastMove);
          } else if (val === 2) {
            drawPieceO(cx, cy, isLastMove);
          }
        }
      }
    }
  }

  // 4. Draw Winning Line highlight
  if (winningLine && winningLine.length >= 5) {
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
    ctx.shadowBlur = 15;

    ctx.beginPath();
    const start = winningLine[0];
    const end = winningLine[winningLine.length - 1];
    ctx.moveTo(start.col * CELL_SIZE + CELL_SIZE / 2, start.row * CELL_SIZE + CELL_SIZE / 2);
    ctx.lineTo(end.col * CELL_SIZE + CELL_SIZE / 2, end.row * CELL_SIZE + CELL_SIZE / 2);
    ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(renderLoop);
}

function drawPieceX(cx, cy, isLast = false) {
  const size = CELL_SIZE * 0.32;

  ctx.save();
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';
  ctx.shadowBlur = isLast ? 14 : 6;

  ctx.beginPath();
  ctx.moveTo(cx - size, cy - size);
  ctx.lineTo(cx + size, cy + size);
  ctx.moveTo(cx + size, cy - size);
  ctx.lineTo(cx - size, cy + size);
  ctx.stroke();

  if (isLast) {
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - CELL_SIZE / 2 + 2, cy - CELL_SIZE / 2 + 2, CELL_SIZE - 4, CELL_SIZE - 4);
  }
  ctx.restore();
}

function drawPieceO(cx, cy, isLast = false) {
  const radius = CELL_SIZE * 0.32;

  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
  ctx.shadowBlur = isLast ? 14 : 6;

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (isLast) {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cx - CELL_SIZE / 2 + 2, cy - CELL_SIZE / 2 + 2, CELL_SIZE - 4, CELL_SIZE - 4);
  }
  ctx.restore();
}
