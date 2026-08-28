import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { WsException } from '@nestjs/websockets';
import {
  CaroGame,
  CaroGameDocument,
  PlayerInfo,
} from './schemas/caro-game.schema';
import {
  CaroMatchHistory,
  CaroMatchHistoryDocument,
} from './schemas/caro-match-history.schema';

export interface WinCheckResult {
  won: boolean;
  winningLine: Array<{ row: number; col: number }>;
}

@Injectable()
export class CaroService {
  public static readonly GRID_SIZE = 15;
  public static readonly WIN_STREAK = 5;

  constructor(
    @InjectModel(CaroGame.name)
    private readonly gameModel: Model<CaroGameDocument>,
    @InjectModel(CaroMatchHistory.name)
    private readonly historyModel: Model<CaroMatchHistoryDocument>,
  ) {}

  // Find an existing waiting match or create a new room
  async findOrCreateMatch(
    user: PlayerInfo,
    isUserOnline?: (userId: string) => boolean,
  ): Promise<{ game: CaroGameDocument; isNew: boolean }> {
    // 1. Query waiting games created by other players
    const waitingGames = await this.gameModel
      .find({
        status: 'waiting',
        'playerX.userId': { $ne: user.userId },
      })
      .sort({ createdAt: 1 })
      .exec();

    for (const cand of waitingGames) {
      // If creator is offline, cancel this ghost room and continue
      if (isUserOnline && !isUserOnline(cand.playerX.userId)) {
        await this.gameModel
          .updateOne(
            { gameId: cand.gameId, status: 'waiting' },
            { $set: { status: 'cancelled' } },
          )
          .exec();
        continue;
      }

      // Atomically join this waiting match
      const matched = await this.gameModel
        .findOneAndUpdate(
          {
            gameId: cand.gameId,
            status: 'waiting',
          },
          {
            $set: {
              playerO: user,
              status: 'playing',
              currentTurn: 'X',
            },
          },
          { new: true },
        )
        .exec();

      if (matched) {
        return { game: matched, isNew: false };
      }
    }

    // 2. Check if the user already has an active waiting game to avoid creating duplicates
    const existingWaiting = await this.gameModel
      .findOne({
        status: 'waiting',
        'playerX.userId': user.userId,
      })
      .exec();

    if (existingWaiting) {
      return { game: existingWaiting, isNew: true };
    }

    // 3. Create a new waiting room
    const board: number[][] = Array.from({ length: CaroService.GRID_SIZE }, () =>
      Array(CaroService.GRID_SIZE).fill(0),
    );

    const gameId = uuidv4();
    const newGame = new this.gameModel({
      gameId,
      board,
      playerX: user,
      playerO: null,
      currentTurn: 'X',
      status: 'waiting',
      winner: null,
      moveCount: 0,
      lastMove: null,
    });

    const saved = await newGame.save();
    return { game: saved, isNew: true };
  }

  // Cancel active matchmaking search for a user
  async cancelMatchmaking(userId: string): Promise<boolean> {
    const result = await this.gameModel
      .updateMany(
        { status: 'waiting', 'playerX.userId': userId },
        { $set: { status: 'cancelled' } },
      )
      .exec();

    return (result.modifiedCount || 0) > 0;
  }

  // Check 5-in-a-row in all 4 directions
  public checkWinner(
    board: number[][],
    row: number,
    col: number,
  ): WinCheckResult {
    if (!board || !board[row]) return { won: false, winningLine: [] };
    const symbol = board[row][col];
    if (symbol === 0) return { won: false, winningLine: [] };

    const directions = [
      { dr: 0, dc: 1 },  // Horizontal
      { dr: 1, dc: 0 },  // Vertical
      { dr: 1, dc: 1 },  // Diagonal ↘
      { dr: 1, dc: -1 }, // Diagonal ↗
    ];

    for (const { dr, dc } of directions) {
      const line: Array<{ row: number; col: number }> = [{ row, col }];

      // Forward direction
      let r = row + dr;
      let c = col + dc;
      while (
        r >= 0 &&
        r < CaroService.GRID_SIZE &&
        c >= 0 &&
        c < CaroService.GRID_SIZE &&
        board[r] &&
        board[r][c] === symbol
      ) {
        line.push({ row: r, col: c });
        r += dr;
        c += dc;
      }

      // Backward direction
      r = row - dr;
      c = col - dc;
      while (
        r >= 0 &&
        r < CaroService.GRID_SIZE &&
        c >= 0 &&
        c < CaroService.GRID_SIZE &&
        board[r] &&
        board[r][c] === symbol
      ) {
        line.push({ row: r, col: c });
        r -= dr;
        c -= dc;
      }

      if (line.length >= CaroService.WIN_STREAK) {
        return { won: true, winningLine: line };
      }
    }

    return { won: false, winningLine: [] };
  }

  // Execute move atomically with turn and cell validation
  async makeMove(
    gameId: string,
    userId: string,
    row: number,
    col: number,
  ): Promise<{
    game: CaroGameDocument;
    isOver: boolean;
    winner?: string | null;
    winnerName?: string;
    reason?: 'win' | 'draw' | 'opponent_disconnected';
    winningLine?: Array<{ row: number; col: number }>;
  }> {
    if (
      row < 0 ||
      row >= CaroService.GRID_SIZE ||
      col < 0 ||
      col >= CaroService.GRID_SIZE
    ) {
      throw new WsException('Tọa độ nước đi không hợp lệ');
    }

    // 1. Fetch current game to check player symbol and turn
    const game = await this.gameModel.findOne({ gameId }).exec();
    if (!game) {
      throw new WsException('Không tìm thấy phòng chơi');
    }
    if (game.status !== 'playing') {
      throw new WsException(`Trận đấu không hoạt động (trạng thái: ${game.status})`);
    }

    let playerSymbol: 'X' | 'O';
    let playerInfo: PlayerInfo;
    if (game.playerX.userId === userId) {
      playerSymbol = 'X';
      playerInfo = game.playerX;
    } else if (game.playerO && game.playerO.userId === userId) {
      playerSymbol = 'O';
      playerInfo = game.playerO;
    } else {
      throw new WsException('Bạn không phải là người chơi trong ván đấu này');
    }

    if (game.currentTurn !== playerSymbol) {
      throw new WsException('Chưa đến lượt của bạn');
    }

    if (!game.board || !game.board[row] || game.board[row][col] !== 0) {
      throw new WsException('Ô này đã có quân cờ');
    }

    const nextTurn = playerSymbol === 'X' ? 'O' : 'X';
    const cellValue = playerSymbol === 'X' ? 1 : 2;

    // 2. ATOMIC UPDATE: Only update if currentTurn matches AND cell is 0 (empty)
    const updatedGame = await this.gameModel
      .findOneAndUpdate(
        {
          gameId,
          status: 'playing',
          currentTurn: playerSymbol,
          [`board.${row}.${col}`]: 0,
        },
        {
          $set: {
            [`board.${row}.${col}`]: cellValue,
            currentTurn: nextTurn,
            lastMove: { row, col, player: playerSymbol },
          },
          $inc: { moveCount: 1 },
        },
        { new: true },
      )
      .exec();

    if (!updatedGame) {
      throw new WsException(
        'Nước đi không hợp lệ: ô đã bị đánh hoặc đã đổi lượt',
      );
    }

    // 3. Check win condition
    const winResult = this.checkWinner(updatedGame.board, row, col);

    if (winResult.won) {
      await this.gameModel
        .updateOne(
          { gameId, status: 'playing' },
          { $set: { status: 'finished', winner: userId } },
        )
        .exec();

      updatedGame.status = 'finished';
      updatedGame.winner = userId;

      this.saveHistory(
        updatedGame,
        userId,
        playerInfo.nickname || playerInfo.username,
        'win',
      ).catch(() => {});

      return {
        game: updatedGame,
        isOver: true,
        winner: userId,
        winnerName: playerInfo.nickname || playerInfo.username,
        reason: 'win',
        winningLine: winResult.winningLine,
      };
    }

    // 4. Check draw (15x15 = 225 cells filled)
    if (updatedGame.moveCount >= CaroService.GRID_SIZE * CaroService.GRID_SIZE) {
      await this.gameModel
        .updateOne(
          { gameId, status: 'playing' },
          { $set: { status: 'finished', winner: 'draw' } },
        )
        .exec();

      updatedGame.status = 'finished';
      updatedGame.winner = 'draw';

      this.saveHistory(updatedGame, 'draw', 'Hòa', 'draw').catch(() => {});

      return {
        game: updatedGame,
        isOver: true,
        winner: 'draw',
        winnerName: 'Hòa',
        reason: 'draw',
      };
    }

    return {
      game: updatedGame,
      isOver: false,
    };
  }

  // Award win to opponent when a player disconnects
  async handleDisconnect(userId: string): Promise<{
    game?: CaroGameDocument;
    winnerId?: string;
    winnerName?: string;
    opponentUserId?: string;
  } | null> {
    // 1. Cancel waiting rooms
    await this.gameModel
      .updateMany(
        { status: 'waiting', 'playerX.userId': userId },
        { $set: { status: 'cancelled' } },
      )
      .exec()
      .catch(() => {});

    // 2. Find any active playing game with this user
    const playingGame = await this.gameModel
      .findOne({
        status: 'playing',
        $or: [{ 'playerX.userId': userId }, { 'playerO.userId': userId }],
      })
      .exec();

    if (!playingGame) return null;

    // Determine the opponent who wins
    const isPlayerX = playingGame.playerX.userId === userId;
    const opponent = isPlayerX ? playingGame.playerO : playingGame.playerX;

    if (!opponent) return null;

    playingGame.status = 'finished';
    playingGame.winner = opponent.userId;
    await playingGame.save();

    const winnerName = opponent.nickname || opponent.username;

    this.saveHistory(
      playingGame,
      opponent.userId,
      winnerName,
      'opponent_disconnected',
    ).catch(() => {});

    return {
      game: playingGame,
      winnerId: opponent.userId,
      winnerName,
      opponentUserId: opponent.userId,
    };
  }

  // Save completed match to match history
  private async saveHistory(
    game: CaroGameDocument,
    winner: string,
    winnerName: string,
    reason: 'win' | 'draw' | 'opponent_disconnected',
  ) {
    try {
      const createdAt = (game as any).createdAt || new Date();
      const durationSeconds = Math.max(
        1,
        Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000),
      );

      const history = new this.historyModel({
        gameId: game.gameId,
        playerX: game.playerX,
        playerO: game.playerO,
        winner,
        winnerName,
        reason,
        totalMoves: game.moveCount,
        durationSeconds,
      });

      await history.save();
    } catch (err) {
      // Ignore duplicate key if already saved
    }
  }

  // Get match history for a user
  async getMatchHistory(userId: string, limit = 20) {
    return this.historyModel
      .find({
        $or: [{ 'playerX.userId': userId }, { 'playerO.userId': userId }],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  // Get game by gameId
  async getGame(gameId: string) {
    return this.gameModel.findOne({ gameId }).exec();
  }
}
