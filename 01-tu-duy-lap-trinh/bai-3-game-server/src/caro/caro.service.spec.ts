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
        dto.board || Array.from({ length: 15 }, () => Array(15).fill(0));
      this.playerX = dto.playerX;
      this.playerO = dto.playerO || null;
      this.currentTurn = dto.currentTurn || 'X';
      this.status = dto.status || 'waiting';
      this.winner = dto.winner || null;
      this.moveCount = dto.moveCount || 0;
      this.lastMove = dto.lastMove || null;
      this.createdAt = dto.createdAt || new Date();
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

    mockHistoryModel = jest.fn().mockImplementation(function (
      this: any,
      dto: any,
    ) {
      Object.assign(this, dto);
      this.save = jest.fn().mockResolvedValue(this);
    });
    mockHistoryModel.find = jest.fn();

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

    it('6. should return won: false if line is less than 5 or empty cell or invalid board', () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let c = 0; c < 4; c++) {
        board[0][c] = 1;
      }

      expect(service.checkWinner(board, 0, 0).won).toBe(false);
      expect(service.checkWinner(board, 5, 5).won).toBe(false);
      expect(service.checkWinner(null as any, 0, 0).won).toBe(false);
      expect(service.checkWinner([] as any, 10, 10).won).toBe(false);
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

    it('7b. should return existing waiting match if user already created one', async () => {
      const existing = new mockGameModel({
        gameId: 'existing-waiting-game',
        playerX: playerA,
        status: 'waiting',
      });

      mockGameModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existing),
      });

      const { game, isNew } = await service.findOrCreateMatch(playerA);
      expect(isNew).toBe(true);
      expect(game.gameId).toBe('existing-waiting-game');
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
      const { game, isNew } = await service.findOrCreateMatch(
        playerB,
        isOnline,
      );
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
      const { game, isNew } = await service.findOrCreateMatch(
        playerB,
        isOnline,
      );

      expect(isNew).toBe(true);
      expect(game.playerX.userId).toBe(playerB.userId);
      expect(mockGameModel.updateOne).toHaveBeenCalledWith(
        { gameId: 'ghost-match-999', status: 'waiting' },
        { $set: { status: 'cancelled' } },
      );
    });

    it('8c. should continue searching if findOneAndUpdate returns null on race condition', async () => {
      const candidateGame = new mockGameModel({
        gameId: 'match-race',
        playerX: playerA,
        status: 'waiting',
      });

      mockGameModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([candidateGame]),
        }),
      });

      // findOneAndUpdate returns null (another player grabbed room)
      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const { isNew } = await service.findOrCreateMatch(playerB);
      expect(isNew).toBe(true);
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

      const result = await service.makeMove(
        'game-caro-1',
        playerA.userId,
        7,
        7,
      );

      expect(result.isOver).toBe(false);
      expect(result.game.currentTurn).toBe('O');
      expect(result.game.board[7][7]).toBe(1);
    });

    it('9b. should allow player O to move when it is O turn', async () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      board[7][7] = 1;

      const gameInstance = new mockGameModel({
        gameId: 'game-caro-o',
        board,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'O',
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      const updatedBoard = Array.from({ length: 15 }, () => Array(15).fill(0));
      updatedBoard[7][7] = 1;
      updatedBoard[8][8] = 2;

      const updatedGameInstance = new mockGameModel({
        gameId: 'game-caro-o',
        board: updatedBoard,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
        moveCount: 2,
        lastMove: { row: 8, col: 8, player: 'O' },
      });

      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedGameInstance),
      });

      const result = await service.makeMove(
        'game-caro-o',
        playerB.userId,
        8,
        8,
      );
      expect(result.isOver).toBe(false);
      expect(result.game.currentTurn).toBe('X');
    });

    it('10. should throw WsException for out of bounds move coordinates', async () => {
      await expect(service.makeMove('g1', 'u1', -1, 5)).rejects.toThrow(
        WsException,
      );
      await expect(service.makeMove('g1', 'u1', 15, 5)).rejects.toThrow(
        WsException,
      );
      await expect(service.makeMove('g1', 'u1', 5, -1)).rejects.toThrow(
        WsException,
      );
      await expect(service.makeMove('g1', 'u1', 5, 15)).rejects.toThrow(
        WsException,
      );
    });

    it('10b. should throw WsException if game does not exist or is not playing', async () => {
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.makeMove('nonexistent', playerA.userId, 0, 0),
      ).rejects.toThrow(WsException);

      const finishedGame = new mockGameModel({
        gameId: 'finished-game',
        status: 'finished',
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(finishedGame),
      });
      await expect(
        service.makeMove('finished-game', playerA.userId, 0, 0),
      ).rejects.toThrow(WsException);
    });

    it('10c. should throw WsException if user is not in the game', async () => {
      const game = new mockGameModel({
        gameId: 'game-1',
        playerX: playerA,
        playerO: playerB,
        status: 'playing',
        currentTurn: 'X',
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(game),
      });
      await expect(
        service.makeMove('game-1', 'stranger-id', 0, 0),
      ).rejects.toThrow(WsException);
    });

    it('10d. should throw WsException if player moves out of turn or cell is already occupied', async () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      board[0][0] = 1;
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

      // Player B attempts to move out of turn
      await expect(
        service.makeMove('game-caro-1', playerB.userId, 1, 1),
      ).rejects.toThrow(WsException);

      // Player A attempts to move on occupied cell
      await expect(
        service.makeMove('game-caro-1', playerA.userId, 0, 0),
      ).rejects.toThrow(WsException);
    });

    it('10e. should throw WsException if atomic update fails due to race condition', async () => {
      const gameInstance = new mockGameModel({
        gameId: 'game-race',
        board: Array.from({ length: 15 }, () => Array(15).fill(0)),
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.makeMove('game-race', playerA.userId, 0, 0),
      ).rejects.toThrow(WsException);
    });

    it('11. should finish game and save history when 5 in a row is achieved', async () => {
      const winningBoard = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let c = 0; c < 5; c++) {
        winningBoard[0][c] = 1;
      }

      const playerXNoNick = { userId: 'u-x', username: 'XUser', nickname: '' };
      const gameInstance = new mockGameModel({
        gameId: 'game-caro-win',
        board: Array.from({ length: 15 }, () => Array(15).fill(0)),
        playerX: playerXNoNick,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
      });

      const updatedWinningInstance = new mockGameModel({
        gameId: 'game-caro-win',
        board: winningBoard,
        playerX: playerXNoNick,
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

      const result = await service.makeMove(
        'game-caro-win',
        playerXNoNick.userId,
        0,
        4,
      );

      expect(result.isOver).toBe(true);
      expect(result.winner).toBe(playerXNoNick.userId);
      expect(result.winnerName).toBe('XUser');
      expect(result.reason).toBe('win');
      expect(result.winningLine).toBeDefined();
      expect(result.winningLine!.length).toBeGreaterThanOrEqual(5);
    });

    it('11b. should detect draw when board is full (moveCount >= 225)', async () => {
      const board = Array.from({ length: 15 }, () => Array(15).fill(0));
      const gameInstance = new mockGameModel({
        gameId: 'game-draw',
        board,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
      });

      const updatedDrawInstance = new mockGameModel({
        gameId: 'game-draw',
        board,
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'O',
        status: 'playing',
        moveCount: 225,
        lastMove: { row: 14, col: 14, player: 'X' },
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      mockGameModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedDrawInstance),
      });

      const result = await service.makeMove(
        'game-draw',
        playerA.userId,
        14,
        14,
      );

      expect(result.isOver).toBe(true);
      expect(result.winner).toBe('draw');
      expect(result.winnerName).toBe('Hòa');
      expect(result.reason).toBe('draw');
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

    it('12b. should handle when player O disconnects and player X has no nickname', async () => {
      const playerXNoNick = {
        userId: 'user-x-no-nick',
        username: 'JustX',
        nickname: '',
      };
      const activeGame = new mockGameModel({
        gameId: 'game-dc-2',
        playerX: playerXNoNick,
        playerO: playerB,
        status: 'playing',
      });

      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });

      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(activeGame),
      });

      // Player B disconnects
      const result = await service.handleDisconnect(playerB.userId);

      expect(result).not.toBeNull();
      expect(result!.winnerId).toBe(playerXNoNick.userId);
      expect(result!.winnerName).toBe('JustX');
    });

    it('12c. should return null if no active playing game exists for disconnected user', async () => {
      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.handleDisconnect('alone-user');
      expect(result).toBeNull();
    });

    it('12d. should return null if game has no opponent', async () => {
      const soloGame = new mockGameModel({
        gameId: 'solo-game',
        playerX: playerA,
        playerO: null,
        status: 'playing',
      });

      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({}),
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(soloGame),
      });

      const result = await service.handleDisconnect(playerA.userId);
      expect(result).toBeNull();
    });
  });

  describe('saveHistory, cancelMatchmaking, getMatchHistory, getGame', () => {
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

    it('13b. should return false if no matches were cancelled', async () => {
      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
      });

      const cancelled = await service.cancelMatchmaking('nobody');
      expect(cancelled).toBe(false);
    });

    it('14. should query match history for a user (with and without limit)', async () => {
      const mockHistory = [{ gameId: 'g1', winner: playerA.userId }];
      mockHistoryModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockHistory),
            }),
          }),
        }),
      });

      const history = await service.getMatchHistory(playerA.userId, 10);
      expect(history).toEqual(mockHistory);

      const defaultHistory = await service.getMatchHistory(playerA.userId);
      expect(defaultHistory).toEqual(mockHistory);
    });

    it('15. should get game by gameId', async () => {
      const mockGame = { gameId: 'game-find-1' };
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockGame),
      });

      const game = await service.getGame('game-find-1');
      expect(game).toEqual(mockGame);
    });

    it('16. should save match history and handle duplicate/save errors gracefully', async () => {
      const gameDoc = new mockGameModel({
        gameId: 'saved-game-1',
        playerX: playerA,
        playerO: playerB,
        moveCount: 10,
        createdAt: new Date(Date.now() - 5000),
      });

      // Normal save
      await (service as any).saveHistory(
        gameDoc,
        playerA.userId,
        'AliceQueen',
        'win',
      );

      // Save without createdAt (fallback branch)
      const gameDocNoCreated = new mockGameModel({
        gameId: 'saved-game-2',
        playerX: playerA,
        playerO: playerB,
        moveCount: 5,
      });
      delete (gameDocNoCreated as any).createdAt;
      await (service as any).saveHistory(
        gameDocNoCreated,
        playerA.userId,
        'AliceQueen',
        'win',
      );

      // Error save (catch block)
      mockHistoryModel.mockImplementationOnce(function (this: any) {
        this.save = jest.fn().mockRejectedValue(new Error('Duplicate error'));
      });
      await (service as any).saveHistory(
        gameDoc,
        playerA.userId,
        'AliceQueen',
        'win',
      );
    });

    it('17. should trigger async catch blocks in makeMove and handleDisconnect when saveHistory fails', async () => {
      // Mock saveHistory to throw
      jest
        .spyOn(service as any, 'saveHistory')
        .mockRejectedValue(new Error('Async save history failed'));

      // Test makeMove winning async catch
      const winningBoard = Array.from({ length: 15 }, () => Array(15).fill(0));
      for (let c = 0; c < 5; c++) winningBoard[0][c] = 1;

      const gameInstance = new mockGameModel({
        gameId: 'game-catch-win',
        board: Array.from({ length: 15 }, () => Array(15).fill(0)),
        playerX: playerA,
        playerO: playerB,
        currentTurn: 'X',
        status: 'playing',
      });
      const updatedWinningInstance = new mockGameModel({
        gameId: 'game-catch-win',
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

      const moveRes = await service.makeMove(
        'game-catch-win',
        playerA.userId,
        0,
        4,
      );
      expect(moveRes.isOver).toBe(true);

      // Test handleDisconnect async catch
      mockGameModel.updateMany.mockReturnValue({
        exec: jest.fn().mockRejectedValue(new Error('Update many failed')),
      });
      mockGameModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(gameInstance),
      });

      const dcRes = await service.handleDisconnect(playerA.userId);
      expect(dcRes).not.toBeNull();
    });
  });
});
