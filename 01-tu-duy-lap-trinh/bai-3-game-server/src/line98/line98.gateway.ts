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
import { Line98Service } from './line98.service';
import { MoveBallDto } from './dto/move-ball.dto';
import { HintGameDto } from './dto/hint-game.dto';
import { WsAuthGuard } from '../common/ws-auth.guard';
import { WsValidationPipe } from '../common/ws-validation.pipe';
import { AllWsExceptionsFilter } from '../common/ws-exception.filter';

@UseFilters(AllWsExceptionsFilter)
@WebSocketGateway({
  namespace: '/line98',
  cors: {
    origin: '*',
  },
})
export class Line98Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(Line98Gateway.name);

  constructor(
    private readonly line98Service: Line98Service,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization;

    if (!token) {
      this.logger.warn(`[Line98] Client ${client.id} missing auth token, disconnecting`);
      client.disconnect();
      return;
    }

    try {
      const cleanToken = token.startsWith('Bearer ')
        ? token.slice(7)
        : token;

      const payload = this.jwtService.verify(cleanToken);
      client.data.user = {
        userId: payload.sub,
        username: payload.username,
      };
      this.logger.log(`[Line98] User ${payload.username} (${client.id}) connected`);
    } catch (err: any) {
      this.logger.warn(`[Line98] Client ${client.id} invalid token: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Line98] Client ${client.id} disconnected`);
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('createGame')
  async handleCreateGame(@ConnectedSocket() client: Socket) {
    try {
      const userId = client.data.user.userId;
      const game = await this.line98Service.createGame(userId);
      return {
        event: 'gameCreated',
        data: {
          gameId: game.gameId,
          board: game.board,
          score: game.score,
          nextBalls: game.nextBalls,
          status: game.status,
        },
      };
    } catch (err: any) {
      return {
        event: 'error',
        data: { message: err.message || 'Lỗi khi tạo ván chơi mới' },
      };
    }
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new WsValidationPipe())
  @SubscribeMessage('moveBall')
  async handleMoveBall(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MoveBallDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const result = await this.line98Service.moveBall(
        dto.gameId,
        userId,
        dto.from,
        dto.to,
      );
      return {
        event: 'gameState',
        data: result,
      };
    } catch (err: any) {
      return {
        event: 'error',
        data: { message: err.message || 'Lỗi khi di chuyển bóng' },
      };
    }
  }

  @UseGuards(WsAuthGuard)
  @UsePipes(new WsValidationPipe())
  @SubscribeMessage('getHint')
  async handleGetHint(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: HintGameDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const hint = await this.line98Service.getHint(dto.gameId, userId);
      return {
        event: 'hintResult',
        data: hint,
      };
    } catch (err: any) {
      return {
        event: 'error',
        data: { message: err.message || 'Lỗi khi lấy gợi ý nước đi' },
      };
    }
  }
}
