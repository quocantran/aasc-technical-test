import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WsException } from '@nestjs/websockets';
import {
  Line98Game,
  Line98GameDocument,
} from './schemas/line98-game.schema';

export interface Position {
  row: number;
  col: number;
}

@Injectable()
export class Line98Service {
  public static readonly GRID_SIZE = 9;
  public static readonly COLOR_COUNT = 5;
  public static readonly SPAWN_COUNT = 3;
  public static readonly WIN_LINE_LENGTH = 5;

  constructor(
    @InjectModel(Line98Game.name)
    private readonly gameModel: Model<Line98GameDocument>,
  ) { }

  // Generate random ball color (1 to COLOR_COUNT)
  private getRandomColor(): number {
    return Math.floor(Math.random() * Line98Service.COLOR_COUNT) + 1;
  }

  // Generate preview array of next balls
  private generateNextBalls(count = Line98Service.SPAWN_COUNT): number[] {
    return Array.from({ length: count }, () => this.getRandomColor());
  }

  // Get all empty cell coordinates on board
  public getEmptyCells(board: number[][]): Position[] {
    const empty: Position[] = [];
    for (let r = 0; r < Line98Service.GRID_SIZE; r++) {
      for (let c = 0; c < Line98Service.GRID_SIZE; c++) {
        if (board[r][c] === 0) {
          empty.push({ row: r, col: c });
        }
      }
    }
    return empty;
  }

  // Create a new Line 98 game session
  async createGame(userId: string): Promise<Line98Game> {
    const board: number[][] = Array.from({ length: Line98Service.GRID_SIZE }, () =>
      Array(Line98Service.GRID_SIZE).fill(0),
    );

    // Initial 3 balls
    const emptyCells = this.getEmptyCells(board);
    this.shuffle(emptyCells);
    const initialCells = emptyCells.slice(0, Line98Service.SPAWN_COUNT);
    for (const cell of initialCells) {
      board[cell.row][cell.col] = this.getRandomColor();
    }

    const nextBalls = this.generateNextBalls();
    const gameId = uuidv4();

    const game = new this.gameModel({
      gameId,
      userId,
      board,
      score: 0,
      nextBalls,
      status: 'playing',
    });

    return game.save();
  }

  // Get active game by ID
  async getGame(gameId: string): Promise<Line98GameDocument | null> {
    return this.gameModel.findOne({ gameId }).exec();
  }

  // BFS shortest pathfinding between two cells
  public findPath(
    board: number[][],
    from: Position,
    to: Position,
  ): Position[] | null {
    if (from.row === to.row && from.col === to.col) return null;
    if (board[to.row][to.col] !== 0) return null;

    const N = Line98Service.GRID_SIZE;
    const startIndex = from.row * N + from.col;
    const targetIndex = to.row * N + to.col;

    const visited = new Uint8Array(81);
    const parent = new Int8Array(81).fill(-1);
    const queue = new Int8Array(81);
    let head = 0;
    let tail = 0;

    visited[startIndex] = 1;
    queue[tail++] = startIndex;

    let found = false;

    while (head < tail) {
      const currIndex = queue[head++];
      if (currIndex === targetIndex) {
        found = true;
        break;
      }

      const cr = Math.floor(currIndex / N);
      const cc = currIndex % N;

      // Check 4 adjacent directions: Up, Down, Left, Right
      if (cr > 0) { // Up
        const ni = (cr - 1) * N + cc;
        if (!visited[ni] && board[cr - 1][cc] === 0) {
          visited[ni] = 1;
          parent[ni] = currIndex;
          queue[tail++] = ni;
        }
      }
      if (cr < N - 1) { // Down
        const ni = (cr + 1) * N + cc;
        if (!visited[ni] && board[cr + 1][cc] === 0) {
          visited[ni] = 1;
          parent[ni] = currIndex;
          queue[tail++] = ni;
        }
      }
      if (cc > 0) { // Left
        const ni = cr * N + (cc - 1);
        if (!visited[ni] && board[cr][cc - 1] === 0) {
          visited[ni] = 1;
          parent[ni] = currIndex;
          queue[tail++] = ni;
        }
      }
      if (cc < N - 1) { // Right
        const ni = cr * N + (cc + 1);
        if (!visited[ni] && board[cr][cc + 1] === 0) {
          visited[ni] = 1;
          parent[ni] = currIndex;
          queue[tail++] = ni;
        }
      }
    }

    if (!found) return null;

    // Reconstruct path from target back to start
    const path: Position[] = [];
    let curr = targetIndex;
    while (curr !== -1) {
      path.unshift({ row: Math.floor(curr / N), col: curr % N });
      curr = parent[curr];
    }

    return path;
  }

  // Check lines of 5+ matching colors in 4 directions
  public checkLines(
    board: number[][],
    targetCells: Position[],
  ): { clearedCells: Position[]; scoreAdded: number } {
    const toClear = new Set<string>();

    const directions = [
      { dr: 0, dc: 1 },  // Horizontal
      { dr: 1, dc: 0 },  // Vertical
      { dr: 1, dc: 1 },  // Diagonal ↘
      { dr: 1, dc: -1 }, // Diagonal ↗
    ];

    for (const cell of targetCells) {
      const color = board[cell.row][cell.col];
      if (color === 0) continue;

      for (const { dr, dc } of directions) {
        const line: Position[] = [cell];

        // Search forward
        let r = cell.row + dr;
        let c = cell.col + dc;
        while (
          r >= 0 &&
          r < Line98Service.GRID_SIZE &&
          c >= 0 &&
          c < Line98Service.GRID_SIZE &&
          board[r][c] === color
        ) {
          line.push({ row: r, col: c });
          r += dr;
          c += dc;
        }

        // Search backward
        r = cell.row - dr;
        c = cell.col - dc;
        while (
          r >= 0 &&
          r < Line98Service.GRID_SIZE &&
          c >= 0 &&
          c < Line98Service.GRID_SIZE &&
          board[r][c] === color
        ) {
          line.push({ row: r, col: c });
          r -= dr;
          c -= dc;
        }

        if (line.length >= Line98Service.WIN_LINE_LENGTH) {
          for (const p of line) {
            toClear.add(`${p.row},${p.col}`);
          }
        }
      }
    }

    const clearedPositions: Position[] = Array.from(toClear).map((coord) => {
      const [row, col] = coord.split(',').map(Number);
      return { row, col };
    });

    // Score: 5 balls = 5 points, each extra ball = +2 points
    let scoreAdded = 0;
    if (clearedPositions.length >= Line98Service.WIN_LINE_LENGTH) {
      scoreAdded =
        5 + (clearedPositions.length - Line98Service.WIN_LINE_LENGTH) * 2;
      for (const p of clearedPositions) {
        board[p.row][p.col] = 0;
      }
    }

    return { clearedCells: clearedPositions, scoreAdded };
  }

  // Spawn preview balls into empty cells
  public spawnBalls(
    board: number[][],
    nextBalls: number[],
  ): {
    spawned: Array<{ row: number; col: number; color: number }>;
    newNextBalls: number[];
    clearedCells: Position[];
    scoreAdded: number;
    isGameOver: boolean;
  } {
    const emptyCells = this.getEmptyCells(board);
    this.shuffle(emptyCells);

    const countToSpawn = Math.min(emptyCells.length, nextBalls.length);
    const spawned: Array<{ row: number; col: number; color: number }> = [];
    const targetCells: Position[] = [];

    for (let i = 0; i < countToSpawn; i++) {
      const cell = emptyCells[i];
      const color = nextBalls[i];
      board[cell.row][cell.col] = color;
      spawned.push({ row: cell.row, col: cell.col, color });
      targetCells.push(cell);
    }

    // Check if newly spawned balls immediately form any 5-ball lines
    const lineResult = this.checkLines(board, targetCells);

    const remainingEmpty = this.getEmptyCells(board);
    const isGameOver = remainingEmpty.length === 0;
    const newNextBalls = isGameOver ? [] : this.generateNextBalls();

    return {
      spawned,
      newNextBalls,
      clearedCells: lineResult.clearedCells,
      scoreAdded: lineResult.scoreAdded,
      isGameOver,
    };
  }

  // Execute a ball move and handle line clears
  async moveBall(
    gameId: string,
    userId: string,
    from: Position,
    to: Position,
  ) {
    const game = await this.gameModel.findOne({ gameId }).exec();
    if (!game) {
      throw new WsException('Không tìm thấy ván chơi');
    }
    if (game.userId !== userId) {
      throw new WsException('Bạn không có quyền thao tác ván chơi này');
    }
    if (game.status !== 'playing') {
      throw new WsException('Ván chơi đã kết thúc');
    }

    const board = game.board.map((row) => [...row]);

    if (board[from.row][from.col] === 0) {
      throw new WsException('Không có bóng ở ô đã chọn');
    }
    if (board[to.row][to.col] !== 0) {
      throw new WsException('Ô đích đã có bóng');
    }

    const path = this.findPath(board, from, to);
    if (!path) {
      throw new WsException('Không có đường đi hợp lệ tới ô đích');
    }

    // Move the ball
    const ballColor = board[from.row][from.col];
    board[from.row][from.col] = 0;
    board[to.row][to.col] = ballColor;

    // Check if moving creates a line of 5+
    const moveLineResult = this.checkLines(board, [to]);
    let newScore = game.score;
    let spawnedBalls: Array<{ row: number; col: number; color: number }> = [];
    let nextBalls = game.nextBalls;
    let status: 'playing' | 'gameover' = 'playing';
    let allClearedCells = [...moveLineResult.clearedCells];

    if (moveLineResult.clearedCells.length > 0) {
      // Line formed! Score points, DO NOT spawn new balls
      newScore += moveLineResult.scoreAdded;
    } else {
      // No line formed: spawn 3 balls
      const spawnResult = this.spawnBalls(board, game.nextBalls);
      spawnedBalls = spawnResult.spawned;
      nextBalls = spawnResult.newNextBalls;
      newScore += spawnResult.scoreAdded;
      allClearedCells.push(...spawnResult.clearedCells);

      if (spawnResult.isGameOver) {
        status = 'gameover';
      }
    }

    // Persist updated game state
    game.board = board;
    game.score = newScore;
    game.nextBalls = nextBalls;
    game.status = status;
    await game.save();

    return {
      gameId: game.gameId,
      board: game.board,
      score: game.score,
      nextBalls: game.nextBalls,
      status: game.status,
      path,
      clearedCells: allClearedCells,
      spawnedBalls,
    };
  }

  // Suggest a valid move hint
  async getHint(gameId: string, userId: string): Promise<{ from: Position; to: Position }> {
    const query = this.gameModel.findOne({ gameId });
    const game = typeof (query as any).lean === 'function'
      ? await (query as any).lean().exec()
      : await query.exec();
    if (!game) {
      throw new WsException('Không tìm thấy ván chơi');
    }
    if (game.userId !== userId) {
      throw new WsException('Không có quyền truy cập');
    }
    if (game.status !== 'playing') {
      throw new WsException('Ván chơi đã kết thúc');
    }

    const board: number[][] = game.board;
    const balls: Array<{ pos: Position; color: number }> = [];
    const emptyCells = this.getEmptyCells(board);

    for (let r = 0; r < Line98Service.GRID_SIZE; r++) {
      for (let c = 0; c < Line98Service.GRID_SIZE; c++) {
        if (board[r][c] !== 0) {
          balls.push({ pos: { row: r, col: c }, color: board[r][c] });
        }
      }
    }

    if (balls.length === 0 || emptyCells.length === 0) {
      throw new WsException('Không có nước đi hợp lệ');
    }

    // Priority 1: Check if any move forms 5 in a row (winning move)
    for (const ball of balls) {
      for (const empty of emptyCells) {
        // Quick check: only test if empty cell has adjacent/aligned balls of same color
        const path = this.findPath(board, ball.pos, empty);
        if (path) {
          const testBoard = board.map((row) => [...row]);
          testBoard[ball.pos.row][ball.pos.col] = 0;
          testBoard[empty.row][empty.col] = ball.color;
          const check = this.checkLines(testBoard, [empty]);
          if (check.clearedCells.length > 0) {
            return { from: ball.pos, to: empty };
          }
        }
      }
    }

    // Priority 2: Return any reachable valid move (shuffled for randomness)
    this.shuffle(balls);
    this.shuffle(emptyCells);

    for (const ball of balls) {
      for (const empty of emptyCells) {
        const path = this.findPath(board, ball.pos, empty);
        if (path) {
          return { from: ball.pos, to: empty };
        }
      }
    }

    throw new WsException('Không tìm thấy đường đi cho bất kỳ quả bóng nào');
  }

  // Fisher-Yates array shuffle
  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
