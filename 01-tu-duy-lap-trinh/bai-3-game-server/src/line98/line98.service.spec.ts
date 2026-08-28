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

  describe('createGame', () => {
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

    it('4. should return null if destination is blocked by balls', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1; // Start ball
      // Block row 0 col 1, row 1 col 0
      board[0][1] = 2;
      board[1][0] = 3;

      const path = service.findPath(board, { row: 0, col: 0 }, { row: 8, col: 8 });
      expect(path).toBeNull();
    });

    it('5. should return null if target cell is already occupied', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      board[0][0] = 1;
      board[0][1] = 2;

      const path = service.findPath(board, { row: 0, col: 0 }, { row: 0, col: 1 });
      expect(path).toBeNull();
    });
  });

  describe('checkLines (Line Detection & Scoring)', () => {
    it('6. should detect and clear horizontal line of 5 balls and award +5 score', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      // Place 5 red balls in row 3, cols 2 to 6
      for (let c = 2; c <= 6; c++) {
        board[3][c] = 1;
      }

      const result = service.checkLines(board, [{ row: 3, col: 4 }]);

      expect(result.clearedCells.length).toBe(5);
      expect(result.scoreAdded).toBe(5);

      // Verify board cleared
      for (let c = 2; c <= 6; c++) {
        expect(board[3][c]).toBe(0);
      }
    });

    it('7. should detect and clear diagonal line and award correct combo points', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      // Place 6 blue balls diagonally (row i, col i for i=1..6) -> 5 + (6-5)*2 = 7 points
      for (let i = 1; i <= 6; i++) {
        board[i][i] = 3;
      }

      const result = service.checkLines(board, [{ row: 3, col: 3 }]);

      expect(result.clearedCells.length).toBe(6);
      expect(result.scoreAdded).toBe(7);
      expect(board[1][1]).toBe(0);
      expect(board[6][6]).toBe(0);
    });

    it('8. should not clear lines with fewer than 5 balls', () => {
      const board = Array.from({ length: 9 }, () => Array(9).fill(0));
      for (let c = 0; c < 4; c++) {
        board[0][c] = 2;
      }

      const result = service.checkLines(board, [{ row: 0, col: 0 }]);
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

    it('10. should throw WsException when moving without a valid path', async () => {
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
  });
});
