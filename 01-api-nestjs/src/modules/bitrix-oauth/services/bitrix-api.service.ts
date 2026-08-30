import {
  Injectable,
  Logger,
  HttpStatus,
  HttpException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { BitrixOAuthService } from './bitrix-oauth.service';
import { BitrixMethod } from '../../../common/constants/bitrix.constants';

/**
 * Generic REST API client service for communicating with Bitrix24 CRM endpoints.
 */
@Injectable()
export class BitrixApiService {
  private readonly logger = new Logger(BitrixApiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly oauthService: BitrixOAuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generic method to call any Bitrix24 REST API method with auto-attached token and reactive 401 retry.
   */
  async callBitrixAPI<T = any>(
    method: BitrixMethod | string,
    payload: Record<string, any> = {},
    isRetry = false,
  ): Promise<T> {
    const token = await this.oauthService.getValidToken();
    const url = `https://${token.domain}/rest/${method}.json`;
    const timeout = this.configService.get<number>(
      'app.bitrix24.apiTimeout',
      10000,
    );

    this.logger.debug(
      `[Bitrix24 API] Calling [POST] ${method} on domain: ${token.domain}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          result: T;
          total?: number;
          error?: string;
          error_description?: string;
        }>(
          url,
          {
            ...payload,
            auth: token.accessToken,
          },
          {
            timeout,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      const data = response.data;
      if (data.error) {
        throw new Error(
          `Bitrix24 API Error [${data.error}]: ${data.error_description || ''}`,
        );
      }

      return data.result;
    } catch (error: any) {
      const bitrixError =
        error.response?.data?.error ||
        error.response?.data?.error_description ||
        error.message;
      const status = error.response?.status;

      this.logger.warn(
        `[Bitrix24 API] Call failed for ${method}: ${bitrixError} (Status: ${status})`,
      );

      // If token expired (401 / expired_token) and not already retrying, force token renewal and retry once
      if (
        (status === HttpStatus.UNAUTHORIZED ||
          bitrixError === 'expired_token' ||
          bitrixError === 'NO_AUTH_FOUND') &&
        !isRetry
      ) {
        this.logger.warn(
          '[Bitrix24 API] Access token expired mid-request, renewing token and retrying...',
        );
        await this.oauthService.refreshToken(token);
        return this.callBitrixAPI<T>(method, payload, true);
      }

      // Map Bitrix24 error responses to appropriate NestJS HTTP exceptions
      this.handleBitrixError(method, error);
    }
  }

  /**
   * Calls Bitrix24 REST API with pagination metadata (result, total, next).
   */
  async callBitrixAPIWithPagination<T = any>(
    method: BitrixMethod | string,
    payload: Record<string, any> = {},
    isRetry = false,
  ): Promise<{ result: T[]; total: number; next?: number }> {
    const token = await this.oauthService.getValidToken();
    const url = `https://${token.domain}/rest/${method}.json`;
    const timeout = this.configService.get<number>(
      'app.bitrix24.apiTimeout',
      10000,
    );

    this.logger.debug(
      `[Bitrix24 API] Calling [POST] ${method} on domain: ${token.domain}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          result: T[];
          total?: number;
          next?: number;
          error?: string;
          error_description?: string;
        }>(
          url,
          {
            ...payload,
            auth: token.accessToken,
          },
          {
            timeout,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      const data = response.data;
      if (data.error) {
        throw new Error(
          `Bitrix24 API Error [${data.error}]: ${data.error_description || ''}`,
        );
      }

      const result = Array.isArray(data.result) ? data.result : [];
      const total = typeof data.total === 'number' ? data.total : result.length;

      return {
        result,
        total,
        next: data.next,
      };
    } catch (error: any) {
      const bitrixError =
        error.response?.data?.error ||
        error.response?.data?.error_description ||
        error.message;
      const status = error.response?.status;

      this.logger.warn(
        `[Bitrix24 API] Call failed for ${method}: ${bitrixError} (Status: ${status})`,
      );

      if (
        (status === HttpStatus.UNAUTHORIZED ||
          bitrixError === 'expired_token' ||
          bitrixError === 'NO_AUTH_FOUND') &&
        !isRetry
      ) {
        this.logger.warn(
          '[Bitrix24 API] Access token expired mid-request, renewing token and retrying...',
        );
        await this.oauthService.refreshToken(token);
        return this.callBitrixAPIWithPagination<T>(method, payload, true);
      }

      this.handleBitrixError(method, error);
    }
  }

  /**
   * Recursively serializes nested payloads into Bitrix24 batch URL query format.
   * Preserves dynamic $result references without over-encoding bracket syntax.
   */
  serializeBatchPayload(params: Record<string, any>, prefix = ''): string {
    const query: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      const fullKey = prefix ? `${prefix}[${key}]` : key;
      if (typeof value === 'object' && !Array.isArray(value)) {
        // Recursively serialize nested object fields
        query.push(this.serializeBatchPayload(value, fullKey));
      } else if (Array.isArray(value)) {
        // Serialize array items with indexed keys (e.g. PHONE[0][VALUE])
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            query.push(
              this.serializeBatchPayload(item, `${fullKey}[${index}]`),
            );
          } else {
            query.push(
              `${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(item)}`,
            );
          }
        });
      } else {
        // Handle scalar values and preserve raw $result[...] batch references
        const valStr = String(value);
        if (valStr.startsWith('$result[')) {
          query.push(`${encodeURIComponent(fullKey)}=${valStr}`);
        } else {
          query.push(
            `${encodeURIComponent(fullKey)}=${encodeURIComponent(valStr)}`,
          );
        }
      }
    }
    return query.filter(Boolean).join('&');
  }

  /**
   * Executes up to 50 Bitrix24 commands in a single HTTP batch request (POST /rest/batch.json).
   * Supports command chaining with $result[cmd] and handles reactive 401 token refresh retry.
   */
  async callBitrixBatch<T = Record<string, any>>(
    commands: Record<string, string>,
    halt: 0 | 1 = 0,
    isRetry = false,
  ): Promise<{
    result: T;
    result_error: Record<string, any>;
    result_total: Record<string, number>;
  }> {
    const token = await this.oauthService.getValidToken();
    const url = `https://${token.domain}/rest/batch.json`;
    const timeout = this.configService.get<number>(
      'app.bitrix24.apiTimeout',
      15000,
    );

    this.logger.debug(
      `[Bitrix24 API] Executing Batch with ${Object.keys(commands).length} commands on domain: ${token.domain}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<{
          result: {
            result: T;
            result_error?: Record<string, any>;
            result_total?: Record<string, number>;
            result_next?: Record<string, number>;
          };
          error?: string;
          error_description?: string;
        }>(
          url,
          {
            halt,
            cmd: commands,
            auth: token.accessToken,
          },
          {
            timeout,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        ),
      );

      const data = response.data;
      if (data.error) {
        throw new Error(
          `Bitrix24 Batch API Error [${data.error}]: ${data.error_description || ''}`,
        );
      }

      return {
        result: data.result.result,
        result_error: data.result.result_error || {},
        result_total: data.result.result_total || {},
      };
    } catch (error: any) {
      const bitrixError =
        error.response?.data?.error ||
        error.response?.data?.error_description ||
        error.message;
      const status = error.response?.status;

      this.logger.warn(
        `[Bitrix24 API] Batch call failed: ${bitrixError} (Status: ${status})`,
      );

      if (
        (status === HttpStatus.UNAUTHORIZED ||
          bitrixError === 'expired_token' ||
          bitrixError === 'NO_AUTH_FOUND') &&
        !isRetry
      ) {
        this.logger.warn(
          '[Bitrix24 API] Access token expired mid-batch-request, renewing token and retrying...',
        );
        await this.oauthService.refreshToken(token);
        return this.callBitrixBatch<T>(commands, halt, true);
      }

      this.handleBitrixError('batch', error);
    }
  }

  /**
   * Translates Bitrix24 error status codes and messages into standard NestJS exceptions.
   */
  private handleBitrixError(method: string, error: any): never {
    const status = error.response?.status;
    const data = error.response?.data;
    const rawErrorDesc =
      data?.error_description || data?.error || error.message || '';
    const errorDescLower = String(rawErrorDesc).toLowerCase();

    if (
      status === HttpStatus.NOT_FOUND ||
      errorDescLower.includes('not found') ||
      errorDescLower.includes('not_found') ||
      errorDescLower.includes('not exist')
    ) {
      throw new NotFoundException(
        `Contact không tồn tại trên hệ thống Bitrix24`,
      );
    }

    if (
      status === HttpStatus.FORBIDDEN ||
      errorDescLower.includes('access_denied') ||
      errorDescLower.includes('access denied') ||
      errorDescLower.includes('insufficient_scope')
    ) {
      throw new ForbiddenException(
        `Không có quyền truy cập phạm vi CRM trên Bitrix24 (${rawErrorDesc})`,
      );
    }

    if (
      status === HttpStatus.BAD_REQUEST ||
      errorDescLower.includes('is not defined') ||
      errorDescLower.includes('required')
    ) {
      throw new BadRequestException(
        `Dữ liệu yêu cầu không hợp lệ hoặc thiếu tham số (${rawErrorDesc})`,
      );
    }

    throw new HttpException(
      {
        success: false,
        message: `Lỗi kết nối Bitrix24 REST API [${method}]: ${rawErrorDesc}`,
        bitrixError: data?.error,
        errorDescription: data?.error_description,
      },
      status || HttpStatus.BAD_GATEWAY,
    );
  }
}
