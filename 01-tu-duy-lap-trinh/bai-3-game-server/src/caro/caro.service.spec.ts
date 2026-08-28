import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WsException } from '@nestjs/websockets';
import { CaroService } from './caro.service';
import { CaroGame } from './schemas/caro-game.schema';
import { CaroMatchHistory } from './schemas/caro-match-history.schema';

describe('CaroService', () => {
  let service: CaroService;
  let mockGameModel: any;
  let mockHistoryModel: any;

  const playerA = {
    userId: 'user-a',
    username: 'Alice',
    nickname: 'AliceQueen',
  };

  const playerB = {
    userId: 'user-b',
    username: 'Bob',
    nickname: 'BobKing',
  };

  beforeEach(async () => {
    function mockGameConstructor(this: any, dto: any) {
      this.gameId = dto.gameId || 'caro-uuid-123';
      this.board =
        dto.board ||
        Array.from({ length: 15 }, () => Array(15).fill(0));
      this.playerX = dto.playerX;
      this.playerO = dto.playerO || null;
      this.currentTurn = dto.currentTurn || 'X';
      this.status = dto.status || 'waiting';
      this.winner = dto.winner || null;
      this.moveCount = dto.moveCount || 0;
      this.lastMove = dto.lastMove || null;
      this.save = jest.fn().mockResolvedValue(this);
      this.toObject = jest.fn().mockReturnValue({ ...this });
    }

    mockGameConstructor.findOne = jest.fn();
    mockGameConstructor.find = jest.fn();
    mockGameConstructor.findOneAndUpdate = jest.fn();
    mockGameConstructor.updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });
    mockGameConstructor.updateMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    mockGameModel = mockGameConstructor;

    function mockHistoryConstructor(this: any, dto: any) {
      Object.assign(this, dto);
      this.save = jest.fn().mockResolvedValue(this);
    }
    mockHistoryConstructor.find = jest.fn();
    mockHistoryModel = mockHistoryConstructor;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaroService,
        {
          provide: getModelToken(CaroGame.name),
          useValue: mockGameModel,
        },
        {
          provide: getModelToken(CaroMatchHistory.name),
          useValue: mockHistoryModel,
        },
      ],
    }).compile();

    service = module.get<CaroService>(CaroService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkWinner', () => {
    it('2. should detect horizontal 5-in-a-row victory', () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let c = 5; c < 10; c++) {
        board[7][c] = 1; // 5 'X' marks in row 7
      }

      const result = service.checkWinner(board, 7, 7);
      expect(result.won).toBe(true);
      expect(result.winningLine.length).toBe(5);
    });

    it('3. should detect vertical 5-in-a-row victory', () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let r = 2; r < 7; r++) {
        board[r][4] = 2; // 5 'O' marks in col 4
      }

      const result = service.checkWinner(board, 4, 4);
      expect(result.won).toBe(true);
      expect(result.winningLine.length).toBe(5);
    });

    it('4. should detect diagonal ↘ 5-in-a-row victory', () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let i = 0; i < 5; i++) {
        board[i][i] = 1;
      }

      const result = service.checkWinner(board, 2, 2);
      expect(result.won).toBe(true);
      expect(result.winningLine.length).toBe(5);
    });

    it('5. should detect diagonal ↗ 5-in-a-row victory', () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let i = 0; i < 5; i++) {
        board[10 - i][i] = 2;
      }

      const result = service.checkWinner(board, 8, 2);
      expect(result.won).toBe(true);
      expect(result.winningLine.length).toBe(5);
    });

    it('6. should return won: false if line is less than 5', () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let c = 0; c < 4; c++) {
        board[0][c] = 1;
      }

      const result = service.checkWinner(board, 0, 0);
      expect(result.won).toBe(false);
    });
  });

  describe('findOrCreateMatch (Matchmaking & Ghost Check)', () => {
    it('7. should create a new waiting match when no opponent is waiting', async () => {
      mockGameModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const { game, isNew } = await service.findOrCreateMatch(playerA);
      expect(isNew).toBe(true);
      expect(game.playerX.userId).toBe(playerA.userId);
      expect(game.status).toBe('waiting');
    });

    it('8. should pair player with existing online waiting match', async () => {
      const candidateGame = new mockGameModel({
        gameId: 'match-123',
        playerX: playerA,
        status: 'waiting',
      });

      mockGameModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([candidateGame]),
        }),
      });

      const matchedGameDoc = new mockGameModel({
        gameId: 'match-123',
        playerX: playerA,
        playerO: playerB,
        status: 'playing',
      });

      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(matchedGameDoc),
      });

      const isOnline = jest.fn().mockReturnValue(true);
      const { game, isNew } = await service.findOrCreateMatch(playerB, isOnline);
      expect(isNew).toBe(false);
      expect(game.status).toBe('playing');
      expect(game.playerO?.userId).toBe(playerB.userId);
      expect(isOnline).toHaveBeenCalledWith(playerA.userId);
    });

    it('8b. should cancel ghost match if waiting player is offline and create new room', async () => {
      const ghostGame = new mockGameModel({
        gameId: 'ghost-match-999',
        playerX: playerA,
        status: 'waiting',
      });

      mockGameModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([ghostGame]),
        }),
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const isOnline = jest.fn().mockReturnValue(false); // Player A is offline
      const { game, isNew } = await service.findOrCreateMatch(playerB, isOnline);

      expect(isNew).toBe(true);
      expect(game.playerX.userId).toBe(playerB.userId);
      expect(mockGameModel.updateOne).toHaveBeenCalledWith(
        { gameId: 'ghost-match-999', status: 'waiting' },
        { $set: { status: 'cancelled' } },
      );
    });
  });

  describe('makeMove (Atomic Execution & Turn Management)', () => {
    it('9. should execute move and toggle turn from X to O', async () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));

      const gameInstance = new mockGameModel({
        gameId: 'game-caro-1',
        board,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      const updatedBoard = Array.from({ length: 15 }, () => Array(15).fill(0));
      updatedBoard[7][7] = 1;
      const updatedGameInstance = new mockGameModel({
        gameId: 'game-caro-1',
        board: updatedBoard,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'O',
        status: 'playing',
        moveCount: 1,
        lastMove: { row: 7, col: 7, player: 'X' },
      });

      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedGameInstance),
      });

      const result = await service.makeMove('game-caro-1', playerA.userId, 7, 7);

      expect(result.isOver).toBe(false);
      expect(result.game.currentTurn).toBe('O');
      expect(result.game.board[7][7]).toBe(1);
    });

    it('10. should throw WsException if player moves out of turn', async () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      const gameInstance = new mockGameModel({
        gameId: 'game-caro-1',
        board,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X', // Player X's turn
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      // Player B attempts to move out of turn
      await expect(
        service.makeMove('game-caro-1', playerB.userId, 0, 0),
      ).rejects.toThrow(WsException);
    });

    it('11. should finish game and save history when 5 in a row is achieved', async () => {
      const winningBoard = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let c = 0; c < 5; c++) {
        winningBoard[0][c] = 1;
      }

      const gameInstance = new mockGameModel({
        gameId: 'game-caro-win',
        board: Array.from({ length: 15 }, () => Array(15).fill(0)),
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
      });

      const updatedWinningInstance = new mockGameModel({
        gameId: 'game-caro-win',
        board: winningBoard,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'O',
        status: 'playing',
        moveCount: 9,
        lastMove: { row: 0, col: 4, player: 'X' },
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedWinningInstance),
      });

      mockGameModel.updateOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      const result = await service.makeMove('game-caro-win', playerA.userId, 0, 4);

      expect(result.isOver).toBe(true);
      expect(result.winner).toBe(playerA.userId);
      expect(result.reason).toBe('win');
      expect(result.winningLine).toBeDefined();
      expect(result.winningLine!.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('handleDisconnect (Graceful Disconnect)', () => {
    it('12. should award win to remaining opponent and mark game finished', async () => {
      const activeGame = new mockGameModel({
        gameId: 'game-dc-1',
        playerX: playerA,
        playerO: playerB,
        status: 'playing',
      });

      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activeGame),
      });

      // Player A disconnects
      const result = await service.handleDisconnect(playerA.userId);

      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe(playerB.userId);
      expect(result!.game!.status).toBe('finished');
    });
  });

  describe('cancelMatchmaking', () => {
    it('13. should cancel waiting match search for user', async () => {
      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      });

      const cancelled = await service.cancelMatchmaking(playerA.userId);
      expect(cancelled).toBe(true);
      expect(mockGameModel.updateMany).toHaveBeenCalledWith(
        { status: 'waiting', 'playerX.userId': playerA.userId },
        { $set: { status: 'cancelled' } },
      );
    });
  });
});
