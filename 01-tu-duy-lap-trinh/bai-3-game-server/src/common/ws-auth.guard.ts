import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    // Check if user is already authenticated and attached to client.data
    if (client.data && client.data.user) {
      return true;
    }

    // Try to extract and verify token from handshake
    const token =
      client.handshake.auth?.token || client.handshake.headers?.authorization;

    if (!token) {
      this.logger.warn(`Unauthorized WS connection attempt: ${client.id}`);
      throw new WsException('Thiếu mã xác thực (Token)');
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

      const payload = this.jwtService.verify(cleanToken);
      client.data.user = {
        userId: payload.sub,
        username: payload.username,
      };
      return true;
    } catch (err: any) {
      this.logger.warn(
        `Invalid WS token for client ${client.id}: ${err.message}`,
      );
      throw new WsException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
  }
}
