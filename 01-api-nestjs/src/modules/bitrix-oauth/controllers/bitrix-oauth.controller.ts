import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { BitrixOAuthService } from '../services/bitrix-oauth.service';
import { InstallAppDto } from '../dtos/install-app.dto';

/**
 * Controller handling Local Application installation events from Bitrix24.
 */
@ApiTags('OAuth 2.0')
@Controller('install')
export class BitrixOAuthController {
  private readonly logger = new Logger(BitrixOAuthController.name);

  constructor(private readonly oauthService: BitrixOAuthService) {}

  /**
   * Receives installation event payload via HTTP POST when application is installed/reinstalled on Bitrix24.
   */
  @Post()
  @ApiOperation({
    summary:
      'Receive Local Application installation event from Bitrix24 (POST)',
    description:
      'Extracts AUTH_ID/REFRESH_ID or authorization code from Bitrix24 payload and persists token to SQLite database.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Application installed and tokens saved successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing token credentials or code in request payload',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Security handshake failed: Invalid or unauthorized token',
  })
  async handleInstall(
    @Body() body: InstallAppDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.logger.log(
      `[Install] Inbound POST installation request from IP: ${req.ip}`,
    );

    // 1. Extract payload credentials from request body
    const accessToken = body.AUTH_ID || body.auth?.access_token;
    const refreshToken = body.REFRESH_ID || body.auth?.refresh_token;
    const domain = body.DOMAIN || body.auth?.domain || 'default';
    const expiresIn = Number(
      body.AUTH_EXPIRES || body.auth?.expires_in || 3600,
    );
    const memberId = body.member_id || body.auth?.member_id;
    const code = body.code;

    // 2. Local Application Flow: Bitrix24 directly provides AUTH_ID and REFRESH_ID
    if (accessToken && refreshToken) {
      // Security Handshake: verifies token with Bitrix24 REST API before persisting
      await this.oauthService.verifyBitrixTokenHandshake(domain, accessToken);

      await this.oauthService.saveToken({
        domain,
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt: Date.now() + expiresIn * 1000,
        memberId,
        scope: body.auth?.scope || 'crm',
      });

      this.logger.log(
        `[Install] Application installed successfully for portal: ${domain}`,
      );
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Application installed and tokens saved successfully',
        domain,
      });
    }

    // 3. Authorization Code Flow: Exchange code for token pair if code parameter is sent
    if (code) {
      const token = await this.oauthService.exchangeCodeForToken(code, domain);
      this.logger.log(
        `[Install] Code exchanged successfully for portal: ${token.domain}`,
      );
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Application installed via authorization code successfully',
        domain: token.domain,
      });
    }

    // 4. Bad request if no valid token or code is found
    this.logger.warn(
      `[Install] Missing token credentials in request: Body=${JSON.stringify(body)}`,
    );
    return res.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      message:
        'Missing AUTH_ID / REFRESH_ID or authorization code in request from Bitrix24.',
    });
  }
}
