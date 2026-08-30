import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { BitrixTokenEntity } from '../entities/bitrix-token.entity';
import {
  SaveTokenDto,
  BitrixOAuthTokenResponse,
} from '../interfaces/token.interface';
import { BITRIX_CONSTANTS } from '../../../common/constants/bitrix.constants';

/**
 * Manages OAuth 2.0 token persistence, validation, and auto-renewal for Bitrix24.
 */
@Injectable()
export class BitrixOAuthService {
  private readonly logger = new Logger(BitrixOAuthService.name);

  constructor(
    @InjectRepository(BitrixTokenEntity)
    private readonly tokenRepository: Repository<BitrixTokenEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Performs an immediate handshake test with Bitrix24 REST API (app.info) before saving tokens.
   */
  async verifyBitrixTokenHandshake(
    domain: string,
    accessToken: string,
  ): Promise<boolean> {
    const testUrl = `https://${domain}/rest/${BITRIX_CONSTANTS.METHODS.APP_INFO}.json`;
    const timeout = this.configService.get<number>(
      'app.bitrix24.apiTimeout',
      5000,
    );

    try {
      this.logger.log(
        `[OAuth] Performing security handshake with Bitrix24 portal (${domain})...`,
      );
      const response = await firstValueFrom(
        this.httpService.get(testUrl, {
          params: { auth: accessToken },
          timeout,
        }),
      );

      if (response.data && (response.data.result || !response.data.error)) {
        this.logger.log(
          `[OAuth] Security handshake passed for portal: ${domain}`,
        );
        return true;
      }

      throw new Error(
        response.data?.error_description || 'Invalid token response',
      );
    } catch (error: any) {
      const errMsg = error.response?.data?.error_description || error.message;
      this.logger.error(
        `[OAuth] Handshake failed for portal ${domain}: ${errMsg}`,
      );
      throw new UnauthorizedException(
        `Xác thực Token với Bitrix24 thất bại: Token không hợp lệ hoặc đã bị từ chối (${errMsg})`,
      );
    }
  }

  /**
   * Persists or updates OAuth token record in the SQLite database.
   */
  async saveToken(dto: SaveTokenDto): Promise<BitrixTokenEntity> {
    const defaultDomain = this.configService.get<string>(
      'app.bitrix24.defaultDomain',
      'default',
    );
    const domain = dto.domain || defaultDomain;
    let tokenRecord = await this.tokenRepository.findOne({ where: { domain } });

    if (!tokenRecord) {
      tokenRecord = this.tokenRepository.create({ domain });
    }

    const expiresIn = dto.expiresIn || 3600;
    const expiresAt = dto.expiresAt || Date.now() + expiresIn * 1000;

    tokenRecord.accessToken = dto.accessToken;
    tokenRecord.refreshToken = dto.refreshToken;
    tokenRecord.expiresIn = expiresIn;
    tokenRecord.expiresAt = expiresAt;
    if (dto.memberId) tokenRecord.memberId = dto.memberId;
    if (dto.scope) tokenRecord.scope = dto.scope;

    const saved = await this.tokenRepository.save(tokenRecord);
    this.logger.log(
      `[OAuth] Token saved for domain: ${domain}, expires at: ${new Date(expiresAt).toLocaleString()}`,
    );
    return saved;
  }

  /**
   * Retrieves the most recent token record from SQLite database.
   */
  async getLatestToken(domain?: string): Promise<BitrixTokenEntity | null> {
    if (domain) {
      return this.tokenRepository.findOne({ where: { domain } });
    }
    const tokens = await this.tokenRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return tokens.length > 0 ? tokens[0] : null;
  }

  /**
   * Checks if access token has expired or is expiring within the 5-minute safety buffer.
   */
  isTokenExpired(token: BitrixTokenEntity): boolean {
    if (!token || !token.expiresAt) return true;
    const bufferTimeMs = 5 * 60 * 1000; // 5-minute safety buffer
    return Date.now() >= token.expiresAt - bufferTimeMs;
  }

  /**
   * Renews access token using stored refresh token via configured OAuth server endpoint.
   */
  async refreshToken(
    currentToken?: BitrixTokenEntity,
  ): Promise<BitrixTokenEntity> {
    const token = currentToken || (await this.getLatestToken());
    if (!token || !token.refreshToken) {
      throw new UnauthorizedException(
        'No refresh_token found. Please reinstall the Local Application on Bitrix24.',
      );
    }

    const clientId = this.configService.get<string>('app.bitrix24.clientId');
    const clientSecret = this.configService.get<string>(
      'app.bitrix24.clientSecret',
    );
    const oauthUrl = this.configService.get<string>(
      'app.bitrix24.oauthUrl',
      BITRIX_CONSTANTS.OAUTH.TOKEN_ENDPOINT,
    );
    const timeout = this.configService.get<number>(
      'app.bitrix24.apiTimeout',
      10000,
    );

    this.logger.log(
      `[OAuth] Refreshing access token for domain: ${token.domain} via ${oauthUrl}...`,
    );

    try {
      const params = {
        grant_type: BITRIX_CONSTANTS.OAUTH.GRANT_TYPE_REFRESH,
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refreshToken,
      };

      const response = await firstValueFrom(
        this.httpService.get<BitrixOAuthTokenResponse>(oauthUrl, {
          params,
          timeout,
        }),
      );

      const data = response.data;
      if (data.error) {
        throw new Error(
          `OAuth Server Error [${data.error}]: ${data.error_description}`,
        );
      }

      const expiresIn = data.expires_in || 3600;
      const expiresAt = data.expires
        ? data.expires * 1000
        : Date.now() + expiresIn * 1000;

      const updatedToken = await this.saveToken({
        domain: token.domain,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn,
        expiresAt,
        memberId: data.member_id || token.memberId,
        scope: data.scope || token.scope,
      });

      this.logger.log(
        `[OAuth] Token renewed successfully! Valid until: ${new Date(expiresAt).toLocaleString()}`,
      );
      return updatedToken;
    } catch (error: any) {
      const errMsg = error.response?.data?.error_description || error.message;
      this.logger.error(`[OAuth] Token renewal failed: ${errMsg}`, error.stack);
      throw new UnauthorizedException(
        `Failed to refresh Bitrix24 token: ${errMsg}`,
      );
    }
  }

  /**
   * Exchanges an authorization code for initial access and refresh tokens.
   */
  async exchangeCodeForToken(
    code: string,
    domain: string,
  ): Promise<BitrixTokenEntity> {
    const clientId = this.configService.get<string>('app.bitrix24.clientId');
    const clientSecret = this.configService.get<string>(
      'app.bitrix24.clientSecret',
    );
    const oauthUrl = this.configService.get<string>(
      'app.bitrix24.oauthUrl',
      BITRIX_CONSTANTS.OAUTH.TOKEN_ENDPOINT,
    );
    const timeout = this.configService.get<number>(
      'app.bitrix24.apiTimeout',
      10000,
    );

    this.logger.log(
      `[OAuth] Exchanging authorization code for domain: ${domain} via ${oauthUrl}...`,
    );

    try {
      const params = {
        grant_type: BITRIX_CONSTANTS.OAUTH.GRANT_TYPE_AUTH_CODE,
        client_id: clientId,
        client_secret: clientSecret,
        code,
        scope: 'crm',
      };

      const response = await firstValueFrom(
        this.httpService.get<BitrixOAuthTokenResponse>(oauthUrl, {
          params,
          timeout,
        }),
      );

      const data = response.data;
      if (data.error) {
        throw new Error(
          `OAuth Exchange Code Error [${data.error}]: ${data.error_description}`,
        );
      }

      const expiresIn = data.expires_in || 3600;
      const expiresAt = data.expires
        ? data.expires * 1000
        : Date.now() + expiresIn * 1000;

      return await this.saveToken({
        domain: domain || data.domain || 'default',
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn,
        expiresAt,
        memberId: data.member_id,
        scope: data.scope,
      });
    } catch (error: any) {
      const errMsg = error.response?.data?.error_description || error.message;
      this.logger.error(
        `[OAuth] Failed to exchange code for token: ${errMsg}`,
        error.stack,
      );
      throw new UnauthorizedException(
        `Failed to exchange authorization code: ${errMsg}`,
      );
    }
  }

  /**
   * Returns a valid access token, proactively refreshing it if expired or expiring soon.
   */
  async getValidToken(): Promise<BitrixTokenEntity> {
    let token = await this.getLatestToken();
    if (!token) {
      throw new UnauthorizedException(
        'No Bitrix24 OAuth token found. Please install the Local Application on Bitrix24 via: https://<ngrok-domain>/install',
      );
    }

    if (this.isTokenExpired(token)) {
      this.logger.warn(
        '[OAuth] Token is expired or expiring soon, triggering renewal...',
      );
      token = await this.refreshToken(token);
    }

    return token;
  }
}
