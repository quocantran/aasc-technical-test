import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { Line98Service } from './line98.service';
import { Line98Game } from './schemas/line98-game.schema';

describe('Line98Service', () => {
  let service: Line98Service;
  let mockGameModel: any;

  beforeEach(async () => {
    function mockConstructor(this: any, dto: any) {
      this.gameId = dto.gameId || 'mock-game-uuid';
      this.userId = dto.userId;
      this.board = dto.board;
      this.score = dto.score || 0;
      this.nextBalls = dto.nextBalls || [1, 2, 3];
      this.status = dto.status || 'playing';
      this.save = jest.fn().mockResolvedValue(this);
    }

    mockConstructor.findOne = jest.fn();

    mockGameModel = mockConstructor;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Line98Service,
        {
          provide: getModelToken(Line98Game.name),
          useValue: mockGameModel,
        },
      ],
    }).compile();

    service = module.get<Line98Service>(Line98Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createGame & getGame', () => {
    it('2. should initialize a 9x9 board with 3 initial balls and 3 nextBalls preview', async () => {
      const game = await service.createGame('user-123');

      expect(game).toBeDefined();
      expect(game.board.length).toBe(9);
      expect(game.board[0].length).toBe(9);

      // Count spawned balls
      let ballCount = 0;
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (game.board[r][c] !== 0) ballCount++;
        }
      }
      expect(ballCount).toBe(3);
      expect(game.nextBalls.length).toBe(3);
      expect(game.score).toBe(0);
      expect(game.status).toBe('playing');
    });

    it('2b. should find game by gameId', async () => {
      const mockGame = { gameId: 'g98-123' };
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const game = await service.getGame('g98-123');
      expect(game).toEqual(mockGame);
    });
  });

  describe('findPath (BFS Pathfinding)', () => {
    it('3. should find shortest BFS path on an empty board', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1; // Start ball

      const path = service.findPath(board, { row: 0, col: 0 }, { row: 0, col: 4 });

      expect(path).not.toBeNull();
      expect(path!.length).toBe(5);
      expect(path![0]).toEqual({ row: 0, col: 0 });
      expect(path![path!.length - 1]).toEqual({ row: 0, col: 4 });
    });

    it('3b. should navigate around obstacles using all 4 directions', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[4][4] = 1;
      // Put a wall in front
      board[4][5] = 2;

      const path = service.findPath(board, { row: 4, col: 4 }, { row: 4, col: 6 });
      expect(path).not.toBeNull();
      expect(path![0]).toEqual({ row: 4, col: 4 });
      expect(path![path!.length - 1]).toEqual({ row: 4, col: 6 });
    });

    it('4. should return null if destination is blocked by balls', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1; // Start ball
      // Block row 0 col 1, row 1 col 0
      board[0][1] = 2;
      board[1][0] = 3;

      const path = service.findPath(board, { row: 0, col: 0 }, { row: 8, col: 8 });
      expect(path).toBeNull();
    });

    it('5. should return null if target cell is already occupied or start equals target', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1;
      board[0][1] = 2;

      expect(service.findPath(board, { row: 0, col: 0 }, { row: 0, col: 1 })).toBeNull();
      expect(service.findPath(board, { row: 0, col: 0 }, { row: 0, col: 0 })).toBeNull();
    });
  });

  describe('checkLines (Line Detection & Scoring)', () => {
    it('6. should detect and clear horizontal line of 5 balls and award +5 score', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let c = 2; c <= 6; c++) {
        board[3][c] = 1;
      }

      const result = service.checkLines(board, [{ row: 3, col: 4 }]);

      expect(result.clearedCells.length).toBe(5);
      expect(result.scoreAdded).toBe(5);

      for (let c = 2; c <= 6; c++) {
        expect(board[3][c]).toBe(0);
      }
    });

    it('6b. should detect and clear vertical line of 5 balls', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let r = 1; r <= 5; r++) {
        board[r][2] = 2;
      }

      const result = service.checkLines(board, [{ row: 3, col: 2 }]);
      expect(result.clearedCells.length).toBe(5);
      expect(result.scoreAdded).toBe(5);
    });

    it('6c. should detect and clear diagonal ↗ line of 5 balls', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let i = 0; i < 5; i++) {
        board[6 - i][2 + i] = 4;
      }

      const result = service.checkLines(board, [{ row: 4, col: 4 }]);
      expect(result.clearedCells.length).toBe(5);
      expect(result.scoreAdded).toBe(5);
    });

    it('7. should detect and clear diagonal line and award correct combo points', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let i = 1; i <= 6; i++) {
        board[i][i] = 3;
      }

      const result = service.checkLines(board, [{ row: 3, col: 3 }]);

      expect(result.clearedCells.length).toBe(6);
      expect(result.scoreAdded).toBe(7);
      expect(board[1][1]).toBe(0);
      expect(board[6][6]).toBe(0);
    });

    it('8. should not clear lines with fewer than 5 balls or empty cells', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let c = 0; c < 4; c++) {
        board[0][c] = 2;
      }

      const result = service.checkLines(board, [{ row: 0, col: 0 }, { row: 5, col: 5 }]);
      expect(result.clearedCells.length).toBe(0);
      expect(result.scoreAdded).toBe(0);
      expect(board[0][0]).toBe(2);
    });
  });

  describe('moveBall', () => {
    it('9. should move ball, spawn 3 new balls if no line formed', async () => {
      const initialBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
      initialBoard[0][0] = 1;

      const mockGame = new mockGameModel({
        gameId: 'game-1',
        userId: 'user-1',
        board: initialBoard,
        score: 0,
        nextBalls: [2, 3, 4],
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const result = await service.moveBall(
        'game-1',
        'user-1',
        { row: 0, col: 0 },
        { row: 0, col: 5 },
      );

      expect(result.path).toBeDefined();
      expect(result.path[0]).toEqual({ row: 0, col: 0 });
      expect(result.path[result.path.length - 1]).toEqual({ row: 0, col: 5 });
      expect(result.board[0][5]).toBe(1);
      expect(result.spawnedBalls.length).toBe(3);
    });

    it('9b. should award points and not spawn balls if move forms a line of 5', async () => {
      const initialBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
      // 4 red balls in row 0
      initialBoard[0][0] = 1;
      initialBoard[0][1] = 1;
      initialBoard[0][2] = 1;
      initialBoard[0][3] = 1;
      // 1 red ball at row 2 col 4
      initialBoard[2][4] = 1;

      const mockGame = new mockGameModel({
        gameId: 'game-win-line',
        userId: 'user-1',
        board: initialBoard,
        score: 10,
        nextBalls: [2, 3, 4],
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const result = await service.moveBall(
        'game-win-line',
        'user-1',
        { row: 2, col: 4 },
        { row: 0, col: 4 },
      );

      expect(result.score).toBe(15); // 10 + 5
      expect(result.clearedCells.length).toBe(5);
      expect(result.spawnedBalls.length).toBe(0);
    });

    it('9c. should trigger gameover when spawn fills the last remaining cells', async () => {
      // Board with alternating colors (so no 5 in a row anywhere)
      const fullBoard = Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => ((r * 2 + c) % 5) + 1),
      );
      // Leave only 2 empty cells: [0][1] (dest) and [0][2]
      fullBoard[0][1] = 0;
      fullBoard[0][2] = 0;

      const mockGame = new mockGameModel({
        gameId: 'game-over-test',
        userId: 'user-1',
        board: fullBoard,
        score: 0,
        nextBalls: [1, 2, 3],
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const result = await service.moveBall(
        'game-over-test',
        'user-1',
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      );

      expect(result.status).toBe('gameover');
      expect(result.nextBalls).toEqual([]);
    });

    it('10. should throw WsException when game not found, wrong user, finished game, or invalid cells', async () => {
      // Game not found
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.moveBall('nonexistent', 'user-1', { row: 0, col: 0 }, { row: 0, col: 1 }),
      ).rejects.toThrow(WsException);

      // Wrong user
      const wrongUserGame = new mockGameModel({
        gameId: 'g1',
        userId: 'user-owner',
        status: 'playing',
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(wrongUserGame),
      });
      await expect(
        service.moveBall('g1', 'user-intruder', { row: 0, col: 0 }, { row: 0, col: 1 }),
      ).rejects.toThrow(WsException);

      // Finished game
      const finishedGame = new mockGameModel({
        gameId: 'g1',
        userId: 'user-1',
        status: 'gameover',
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(finishedGame),
      });
      await expect(
        service.moveBall('g1', 'user-1', { row: 0, col: 0 }, { row: 0, col: 1 }),
      ).rejects.toThrow(WsException);

      // Selected empty cell (no ball at from)
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      const gameWithBoard = new mockGameModel({
        gameId: 'g1',
        userId: 'user-1',
        board,
        status: 'playing',
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameWithBoard),
      });
      await expect(
        service.moveBall('g1', 'user-1', { row: 0, col: 0 }, { row: 0, col: 1 }),
      ).rejects.toThrow(WsException);

      // Target cell already occupied
      board[0][0] = 1;
      board[0][1] = 2;
      await expect(
        service.moveBall('g1', 'user-1', { row: 0, col: 0 }, { row: 0, col: 1 }),
      ).rejects.toThrow(WsException);
    });

    it('10b. should throw WsException when moving without a valid path', async () => {
      const initialBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
      initialBoard[0][0] = 1;
      initialBoard[0][1] = 2;
      initialBoard[1][0] = 2;

      const mockGame = new mockGameModel({
        gameId: 'game-1',
        userId: 'user-1',
        board: initialBoard,
        score: 0,
        nextBalls: [1, 2, 3],
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      await expect(
        service.moveBall(
          'game-1',
          'user-1',
          { row: 0, col: 0 },
          { row: 8, col: 8 },
        ),
      ).rejects.toThrow(WsException);
    });
  });

  describe('getHint', () => {
    it('11. should find a winning move if available', async () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      // 4 red balls in row 0
      board[0][0] = 1;
      board[0][1] = 1;
      board[0][2] = 1;
      board[0][3] = 1;
      // 1 red ball at row 2 col 0 (can move to row 0 col 4)
      board[2][0] = 1;

      const mockGame = new mockGameModel({
        gameId: 'game-hint',
        userId: 'user-hint',
        board,
        score: 0,
        nextBalls: [1, 2, 3],
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const hint = await service.getHint('game-hint', 'user-hint');
      expect(hint).toBeDefined();
      expect(hint.to).toEqual({ row: 0, col: 4 });
      expect(hint.from).toEqual({ row: 2, col: 0 });
    });

    it('11b. should return a valid non-winning move if no winning move exists', async () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1;

      const mockGame = new mockGameModel({
        gameId: 'game-hint-random',
        userId: 'user-hint',
        board,
        score: 0,
        nextBalls: [1, 2, 3],
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const hint = await service.getHint('game-hint-random', 'user-hint');
      expect(hint).toBeDefined();
      expect(hint.from).toEqual({ row: 0, col: 0 });
    });

    it('12. should throw WsException when getting hint on nonexistent, unauthorized, finished, or invalid board state', async () => {
      // Nonexistent game
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(service.getHint('nonexistent', 'u1')).rejects.toThrow(WsException);

      // Unauthorized
      const game1 = new mockGameModel({ gameId: 'g1', userId: 'owner', status: 'playing', board: [] });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game1),
      });
      await expect(service.getHint('g1', 'intruder')).rejects.toThrow(WsException);

      // Finished game
      const game2 = new mockGameModel({ gameId: 'g1', userId: 'u1', status: 'gameover', board: [] });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game2),
      });
      await expect(service.getHint('g1', 'u1')).rejects.toThrow(WsException);

      // No balls on board
      const emptyBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
      const game3 = new mockGameModel({ gameId: 'g1', userId: 'u1', status: 'playing', board: emptyBoard });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game3),
      });
      await expect(service.getHint('g1', 'u1')).rejects.toThrow(WsException);

      // All balls completely trapped without any valid move
      const trappedBoard = Array.from({ length: 9 }, () => Array(9).fill(0));
      trappedBoard[0][0] = 1;
      const game4 = new mockGameModel({ gameId: 'g1', userId: 'u1', status: 'playing', board: trappedBoard });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game4),
      });
      // Spy on findPath returning null to test line 428
      jest.spyOn(service, 'findPath').mockReturnValue(null);
      await expect(service.getHint('g1', 'u1')).rejects.toThrow(WsException);
    });

    it('13. should handle lean() query branch when retrieving game for hint', async () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1;
      const gameData = { gameId: 'lean-game', userId: 'u1', status: 'playing', board };

      mockGameModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(gameData),
        }),
      });

      const hint = await service.getHint('lean-game', 'u1');
      expect(hint).toBeDefined();
      expect(hint.from).toEqual({ row: 0, col: 0 });
    });
  });
});

