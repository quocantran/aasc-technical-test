import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class AllWsExceptionsFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(AllWsExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const errorData =
      exception instanceof WsException
        ? exception.getError()
        : exception instanceof Error
        ? exception.message
        : 'Internal WebSocket error';

    const message =
      typeof errorData === 'object' && errorData !== null
        ? (errorData as any).message || JSON.stringify(errorData)
        : String(errorData);

    this.logger.warn(`[WS] Exception on socket ${client?.id}: ${message}`);

    if (client && typeof client.emit === 'function') {
      client.emit('error', { message });
    }
  }
}
