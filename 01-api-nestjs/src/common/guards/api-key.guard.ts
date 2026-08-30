import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protects endpoints by verifying the secret key in the `x-api-key` header.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];
    const validApiKey =
      this.configService.get<string>('app.apiKey') ||
      this.configService.get<string>('apiKey');

    // Grant access if header matches the configured API key
    if (validApiKey && apiKeyHeader === validApiKey) {
      return true;
    }

    throw new UnauthorizedException({
      success: false,
      statusCode: 401,
      message:
        'Không có quyền truy cập: Header x-api-key không hợp lệ hoặc bị thiếu',
      error: 'UNAUTHORIZED',
    });
  }
}
