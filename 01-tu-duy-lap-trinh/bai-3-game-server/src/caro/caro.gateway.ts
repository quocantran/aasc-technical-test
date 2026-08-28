import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { CaroService } from './caro.service';
import { MakeMoveDto } from './dto/make-move.dto';
import { WsAuthGuard } from '../common/ws-auth.guard';
import { WsValidationPipe } from '../common/ws-validation.pipe';
import { AllWsExceptionsFilter } from '../common/ws-exception.filter';

@UseFilters(AllWsExceptionsFilter)
@WebSocketGateway({
  namespace: '/caro',
  cors: {
    origin: '*',
  },
})
export class CaroGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CaroGateway.name);

  // Map socketId -> userId and active gameId for quick lookup
  private readonly clientMap = new Map<
    string,
    { userId: string; username: string; nickname: string; gameId?: string }
  >();

  // Map userId -> Set of active socketIds
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly caroService: CaroService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization;

    if (!token) {
      this.logger.warn(`[Caro] Client ${client.id} missing auth token, disconnecting`);
      client.disconnect();
      return;
    }

    try {
      const cleanToken = token.startsWith('Bearer ')
        ? token.slice(7)
        : token;

      const payload = this.jwtService.verify(cleanToken);
      const userData = {
        userId: payload.sub,
        username: payload.username,
        nickname: payload.nickname || payload.username,
      };

      client.data.user = userData;
      this.clientMap.set(client.id, userData);

      if (!this.userSockets.has(userData.userId)) {
        this.userSockets.set(userData.userId, new Set());
      }
      this.userSockets.get(userData.userId)!.add(client.id);

      this.logger.log(`[Caro] User ${payload.username} (${client.id}) connected`);
    } catch (err: any) {
      this.logger.warn(`[Caro] Client ${client.id} invalid token: ${err.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const clientInfo = this.clientMap.get(client.id);
    this.clientMap.delete(client.id);

    if (clientInfo) {
      this.logger.log(`[Caro] User ${clientInfo.username} (${client.id}) disconnected`);

      const sockets = this.userSockets.get(clientInfo.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(clientInfo.userId);
        }
      }

      // ONLY award disconnect victory if the user has NO remaining active sockets
      const remainingSockets = this.userSockets.get(clientInfo.userId);
      if (!remainingSockets || remainingSockets.size === 0) {
        const result = await this.caroService.handleDisconnect(clientInfo.userId);
        if (result && result.game) {
          const roomName = `game:${result.game.gameId}`;
          this.server.to(roomName).emit('opponentDisconnected', {
            winner: result.winnerId,
            winnerName: result.winnerName,
            reason: 'opponent_disconnected',
          });
          this.server.to(roomName).emit('gameOver', {
            gameId: result.game.gameId,
            winner: result.winnerId,
            winnerName: result.winnerName,
            reason: 'opponent_disconnected',
          });
        }
      }
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('findMatch')
  async handleFindMatch(@ConnectedSocket() client: Socket) {
    try {
      const user = client.data.user;

      // Online checker: user is online if they have active socket connections
      const isOnline = (userId: string) => {
        const sockets = this.userSockets.get(userId);
        return !!sockets && sockets.size > 0;
      };

      const { game, isNew } = await this.caroService.findOrCreateMatch(user, isOnline);
      const roomName = `game:${game.gameId}`;

      await client.join(roomName);

      // Track active gameId
      const clientInfo = this.clientMap.get(client.id);
      if (clientInfo) clientInfo.gameId = game.gameId;

      if (isNew) {
        // Player is waiting for an opponent
        return {
          event: 'waitingForOpponent',
          data: {
            gameId: game.gameId,
            message: 'Đang tìm kiếm đối thủ...',
            player: 'X',
          },
        };
      } else {
        // Match found! Broadcast match start to both players in the room
        const matchPayload = {
          gameId: game.gameId,
          board: game.board,
          playerX: game.playerX,
          playerO: game.playerO,
          currentTurn: game.currentTurn,
          status: game.status,
        };

        this.server.to(roomName).emit('matchFound', matchPayload);
      }
    } catch (err: any) {
      return {
        event: 'error',
        data: { message: err.message || 'Lỗi khi tìm trận' },
      };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('cancelFindMatch')
  async handleCancelFindMatch(@ConnectedSocket() client: Socket) {
    try {
      const user = client.data.user;
      await this.caroService.cancelMatchmaking(user.userId);

      const clientInfo = this.clientMap.get(client.id);
      if (clientInfo && clientInfo.gameId) {
        await client.leave(`game:${clientInfo.gameId}`);
        clientInfo.gameId = undefined;
      }

      return {
        event: 'matchCancelled',
        data: { message: 'Đã hủy tìm trận' },
      };
    } catch (err: any) {
      return {
        event: 'error',
        data: { message: err.message || 'Lỗi khi hủy tìm trận' },
      };
    }
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new WsValidationPipe())
  @SubscribeMessage('makeMove')
  async handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MakeMoveDto,
  ) {
    try {
      const user = client.data.user;
      const roomName = `game:${dto.gameId}`;

      const result = await this.caroService.makeMove(
        dto.gameId,
        user.userId,
        dto.row,
        dto.col,
      );

      // Broadcast move state to all players in the room
      const statePayload = {
        gameId: result.game.gameId,
        board: result.game.board,
        currentTurn: result.game.currentTurn,
        lastMove: result.game.lastMove,
        status: result.game.status,
      };

      this.server.to(roomName).emit('gameState', statePayload);

      // If game is finished, broadcast game over
      if (result.isOver) {
        this.server.to(roomName).emit('gameOver', {
          gameId: result.game.gameId,
          winner: result.winner,
          winnerName: result.winnerName,
          reason: result.reason,
          winningLine: result.winningLine,
        });
      }

      return {
        event: 'moveSuccess',
        data: statePayload,
      };
    } catch (err: any) {
      return {
        event: 'error',
        data: { message: err.message || 'Lỗi khi thực hiện nước đi' },
      };
    }
  }
}
