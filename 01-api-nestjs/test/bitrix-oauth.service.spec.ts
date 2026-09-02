import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { of, throwError, Observable } from 'rxjs';
import { BitrixOAuthService } from '../src/modules/bitrix-oauth/services/bitrix-oauth.service';
import { BitrixTokenEntity } from '../src/modules/bitrix-oauth/entities/bitrix-token.entity';

describe('BitrixOAuthService', () => {
  let service: BitrixOAuthService;
  let mockTokenRepo: any;
  let mockHttpService: any;
  let mockConfigService: any;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  beforeEach(async () => {
    mockTokenRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto: any) => ({ ...dto })),
      save: jest
        .fn()
        .mockImplementation((entity: any) =>
          Promise.resolve({ id: 1, ...entity }),
        ),
    };

    mockHttpService = {
      get: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'app.bitrix24.clientId') return 'mock_client_id';
        if (key === 'app.bitrix24.clientSecret') return 'mock_client_secret';
        if (key === 'app.bitrix24.defaultDomain') return 'b24-test.bitrix24.vn';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BitrixOAuthService,
        {
          provide: getRepositoryToken(BitrixTokenEntity),
          useValue: mockTokenRepo,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BitrixOAuthService>(BitrixOAuthService);
  });

  it('1. saveToken() - should create new token when record not found', async () => {
    const dto = {
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'test_access_token_123',
      refreshToken: 'test_refresh_token_456',
      expiresIn: 3600,
      memberId: 'test_member_id',
    };

    mockTokenRepo.findOne.mockResolvedValue(null);

    const result = await service.saveToken(dto);

    expect(result).toBeDefined();
    expect(result.domain).toBe('b24-test.bitrix24.vn');
    expect(result.accessToken).toBe('test_access_token_123');
    expect(result.refreshToken).toBe('test_refresh_token_456');
    expect(mockTokenRepo.save).toHaveBeenCalled();
  });

  it('2. saveToken() - should update existing token when record exists', async () => {
    const existing = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'old_access',
      refreshToken: 'old_refresh',
    };
    mockTokenRepo.findOne.mockResolvedValue(existing);

    const result = await service.saveToken({
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'new_access',
      refreshToken: 'new_refresh',
      scope: 'crm',
    });

    expect(result.accessToken).toBe('new_access');
    expect(result.scope).toBe('crm');
  });

  it('3. isTokenExpired() - should correctly identify expired or expiring tokens (< 5 mins)', () => {
    const expiredToken: any = {
      expiresAt: Date.now() - 1000,
    };

    const expiringSoonToken: any = {
      expiresAt: Date.now() + 2 * 60 * 1000,
    };

    const validToken: any = {
      expiresAt: Date.now() + 30 * 60 * 1000,
    };

    expect(service.isTokenExpired(expiredToken)).toBe(true);
    expect(service.isTokenExpired(expiringSoonToken)).toBe(true);
    expect(service.isTokenExpired(validToken)).toBe(false);
    expect(service.isTokenExpired(null as any)).toBe(true);
  });

  it('4. refreshToken() - should request renewal tokens from OAuth server and update SQLite', async () => {
    const currentToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'old_access_token',
      refreshToken: 'old_refresh_token',
      expiresAt: Date.now() - 1000,
    };

    const oauthResponse = {
      data: {
        access_token: 'new_access_token_789',
        refresh_token: 'new_refresh_token_789',
        expires_in: 3600,
        expires: Math.floor(Date.now() / 1000) + 3600,
        domain: 'b24-test.bitrix24.vn',
        member_id: 'test_member_id',
      },
    };

    mockHttpService.get.mockReturnValue(of(oauthResponse));
    mockTokenRepo.findOne.mockResolvedValue(currentToken);

    const result = await service.refreshToken(currentToken);

    expect(result).toBeDefined();
    expect(result.accessToken).toBe('new_access_token_789');
    expect(result.refreshToken).toBe('new_refresh_token_789');
    expect(mockHttpService.get).toHaveBeenCalled();
  });

  it('5. refreshToken() - should throw UnauthorizedException when no refresh token exists', async () => {
    mockTokenRepo.find.mockResolvedValue([]);
    await expect(service.refreshToken()).rejects.toThrow(UnauthorizedException);
  });

  it('6. refreshToken() - should throw UnauthorizedException when OAuth endpoint returns error', async () => {
    const token: any = {
      domain: 'b24-test.bitrix24.vn',
      refreshToken: 'bad_refresh',
    };
    mockHttpService.get.mockReturnValue(
      throwError(() => new Error('OAuth error')),
    );
    await expect(service.refreshToken(token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('6b. refreshToken() - should coalesce 10 concurrent calls into a single OAuth HTTP request (Single-Flight Mutex with latency simulation)', async () => {
    const currentToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'old_access_token',
      refreshToken: 'old_refresh_token',
      expiresAt: Date.now() - 1000,
    };

    const oauthResponse = {
      data: {
        access_token: 'new_access_token_single_flight',
        refresh_token: 'new_refresh_token_single_flight',
        expires_in: 3600,
        expires: Math.floor(Date.now() / 1000) + 3600,
        domain: 'b24-test.bitrix24.vn',
      },
    };

    // Deliberate 50ms latency simulation to guarantee requests overlap during in-flight network flight
    mockHttpService.get.mockImplementation(
      () =>
        new Observable((subscriber) => {
          setTimeout(() => {
            subscriber.next(oauthResponse);
            subscriber.complete();
          }, 50);
        }),
    );
    mockTokenRepo.findOne.mockResolvedValue(null);

    // Trigger 10 concurrent refreshToken() calls in parallel
    const concurrentCalls = Array.from({ length: 10 }, () =>
      service.refreshToken(currentToken),
    );
    const results = await Promise.all(concurrentCalls);

    // 1. Verify all 10 calls received the identical new token pair
    expect(results).toHaveLength(10);
    results.forEach((res) => {
      expect(res.accessToken).toBe('new_access_token_single_flight');
      expect(res.refreshToken).toBe('new_refresh_token_single_flight');
    });

    // 2. Assert HTTP request and database save were executed EXACTLY once
    expect(mockHttpService.get).toHaveBeenCalledTimes(1);
    expect(mockTokenRepo.save).toHaveBeenCalledTimes(1);

    // 3. Assert lock is released
    expect((service as any).refreshPromise).toBeNull();

    // 4. Sequential 11th call after lock release with subsequent expired token triggers a new refresh cycle
    const subsequentExpiredToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'new_access_token_single_flight',
      refreshToken: 'new_refresh_token_single_flight',
      expiresAt: Date.now() - 1000,
    };

    const call11Result = await service.refreshToken(subsequentExpiredToken);
    expect(call11Result.accessToken).toBe('new_access_token_single_flight');
    expect(mockHttpService.get).toHaveBeenCalledTimes(2);
    expect(mockTokenRepo.save).toHaveBeenCalledTimes(2);
  });

  it('6c. refreshToken() - should skip Bitrix OAuth HTTP call if SQLite already has fresh token (Double-Check optimization)', async () => {
    const alreadyFreshToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'freshly_renewed_token',
      refreshToken: 'fresh_refresh_token',
      expiresAt: Date.now() + 3000 * 1000, // Valid for 50 minutes
    };

    // Simulate another concurrent request has already written fresh token into SQLite
    mockTokenRepo.find.mockResolvedValue([alreadyFreshToken]);
    mockTokenRepo.findOne.mockResolvedValue(alreadyFreshToken);

    const result = await service.refreshToken();

    expect(result.accessToken).toBe('freshly_renewed_token');
    // HTTP call should NOT be made
    expect(mockHttpService.get).not.toHaveBeenCalled();
  });

  it('7. exchangeCodeForToken() - should exchange code for token successfully', async () => {
    const oauthResponse = {
      data: {
        access_token: 'code_access_token',
        refresh_token: 'code_refresh_token',
        expires_in: 3600,
        domain: 'b24-code.bitrix24.vn',
        member_id: 'code_member_id',
        scope: 'crm',
      },
    };

    mockHttpService.get.mockReturnValue(of(oauthResponse));
    mockTokenRepo.findOne.mockResolvedValue(null);

    const result = await service.exchangeCodeForToken(
      'auth_code_123',
      'b24-code.bitrix24.vn',
    );

    expect(result).toBeDefined();
    expect(result.accessToken).toBe('code_access_token');
  });

  it('8. exchangeCodeForToken() - should throw UnauthorizedException on failure', async () => {
    mockHttpService.get.mockReturnValue(
      throwError(() => new Error('Invalid code')),
    );
    await expect(
      service.exchangeCodeForToken('bad_code', 'b24-code.bitrix24.vn'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('9. getValidToken() - should return valid token directly or throw when no token exists', async () => {
    // When no token exists
    mockTokenRepo.find.mockResolvedValue([]);
    await expect(service.getValidToken()).rejects.toThrow(
      UnauthorizedException,
    );

    // When valid token exists
    const validToken: any = {
      id: 1,
      domain: 'b24-valid.bitrix24.vn',
      accessToken: 'valid_tok',
      refreshToken: 'valid_ref',
      expiresAt: Date.now() + 3600 * 1000,
    };
    mockTokenRepo.find.mockResolvedValue([validToken]);

    const result = await service.getValidToken();
    expect(result.accessToken).toBe('valid_tok');
  });

  it('10. getLatestToken() - should retrieve token by specific domain or latest', async () => {
    const token: any = { id: 1, domain: 'specific.bitrix24.vn' };
    mockTokenRepo.findOne.mockResolvedValue(token);

    const res1 = await service.getLatestToken('specific.bitrix24.vn');
    expect(res1?.domain).toBe('specific.bitrix24.vn');

    mockTokenRepo.find.mockResolvedValue([token]);
    const res2 = await service.getLatestToken();
    expect(res2?.domain).toBe('specific.bitrix24.vn');
  });

  it('11. verifyBitrixTokenHandshake() - should succeed when Bitrix24 returns valid app info', async () => {
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          result: { CODE: 'mock_app_code_xyz', INSTALLED: 'Y' },
        },
      }),
    );

    const isValid = await service.verifyBitrixTokenHandshake(
      'b24-test.bitrix24.vn',
      'valid_token',
    );
    expect(isValid).toBe(true);
  });

  it('12. verifyBitrixTokenHandshake() - should throw UnauthorizedException when Bitrix24 rejects token', async () => {
    mockHttpService.get.mockReturnValue(
      throwError(() => ({
        response: {
          data: {
            error: 'INVALID_CREDENTIALS',
            error_description: 'The access token provided is invalid.',
          },
        },
      })),
    );

    await expect(
      service.verifyBitrixTokenHandshake(
        'b24-test.bitrix24.vn',
        'fake_token_attacker',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('13. verifyBitrixTokenHandshake() - should throw UnauthorizedException when response body contains error', async () => {
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          error: 'ERROR_AUTH',
          error_description: 'Invalid token response',
        },
      }),
    );

    await expect(
      service.verifyBitrixTokenHandshake(
        'b24-test.bitrix24.vn',
        'invalid_token',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('14. saveToken() - should use default domain and calculate expiration when optional fields omitted', async () => {
    mockTokenRepo.findOne.mockResolvedValue(null);

    const result = await service.saveToken({
      accessToken: 'access_only',
      refreshToken: 'refresh_only',
    });

    expect(result.domain).toBe('b24-test.bitrix24.vn');
    expect(result.expiresIn).toBe(3600);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('15. refreshToken() - should throw when OAuth response body contains error field', async () => {
    const currentToken: any = {
      domain: 'b24-test.bitrix24.vn',
      refreshToken: 'bad_token',
    };
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          error: 'invalid_grant',
          error_description: 'Refresh token expired',
        },
      }),
    );

    await expect(service.refreshToken(currentToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('16. refreshToken() - should calculate expiration when `expires` field is not provided', async () => {
    const currentToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      refreshToken: 'good_refresh',
    };
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          access_token: 'new_acc',
          refresh_token: 'new_ref',
          expires_in: 7200,
        },
      }),
    );
    mockTokenRepo.findOne.mockResolvedValue(currentToken);

    const result = await service.refreshToken(currentToken);
    expect(result.accessToken).toBe('new_acc');
    expect(result.expiresIn).toBe(7200);
  });

  it('17. exchangeCodeForToken() - should throw when OAuth response body contains error', async () => {
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          error: 'invalid_code',
          error_description: 'Authorization code is invalid',
        },
      }),
    );

    await expect(
      service.exchangeCodeForToken('bad_code', 'b24-test.bitrix24.vn'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('18. exchangeCodeForToken() - should handle fallback domain and missing `expires` field', async () => {
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          access_token: 'code_acc',
          refresh_token: 'code_ref',
          domain: 'b24-returned.bitrix24.vn',
          expires_in: 3600,
        },
      }),
    );
    mockTokenRepo.findOne.mockResolvedValue(null);

    const result = await service.exchangeCodeForToken('valid_code', '');
    expect(result.domain).toBe('b24-returned.bitrix24.vn');
    expect(result.accessToken).toBe('code_acc');
  });

  it('19. getValidToken() - should proactively refresh token when current token is expired', async () => {
    const expiredToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      accessToken: 'old_expired_acc',
      refreshToken: 'valid_refresh',
      expiresAt: Date.now() - 10000,
    };

    mockTokenRepo.find.mockResolvedValue([expiredToken]);
    mockTokenRepo.findOne.mockResolvedValue(expiredToken);

    mockHttpService.get.mockReturnValue(
      of({
        data: {
          access_token: 'proactively_renewed_token',
          refresh_token: 'new_refresh',
          expires_in: 3600,
        },
      }),
    );

    const result = await service.getValidToken();
    expect(result.accessToken).toBe('proactively_renewed_token');
    expect(mockHttpService.get).toHaveBeenCalled();
  });

  it('20. verifyBitrixTokenHandshake() - should fallback to default error message when error_description is missing', async () => {
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          error: 'UNKNOWN_ERR',
        },
      }),
    );

    await expect(
      service.verifyBitrixTokenHandshake('b24-test.bitrix24.vn', 'test_tok'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('21. refreshToken() - should handle fallback fields when response contains minimal data', async () => {
    const currentToken: any = {
      id: 1,
      domain: 'b24-test.bitrix24.vn',
      refreshToken: 'minimal_refresh',
      memberId: 'orig_member',
      scope: 'crm',
    };
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          access_token: 'min_acc',
          refresh_token: 'min_ref',
        },
      }),
    );
    mockTokenRepo.findOne.mockResolvedValue(currentToken);

    const result = await service.refreshToken(currentToken);
    expect(result.accessToken).toBe('min_acc');
    expect(result.memberId).toBe('orig_member');
    expect(result.scope).toBe('crm');
  });

  it('22. exchangeCodeForToken() - should handle timestamp expires and absolute default domain fallback', async () => {
    const timestampSec = Math.floor(Date.now() / 1000) + 7200;
    mockHttpService.get.mockReturnValue(
      of({
        data: {
          access_token: 'ts_acc',
          refresh_token: 'ts_ref',
          expires: timestampSec,
        },
      }),
    );
    mockTokenRepo.findOne.mockResolvedValue(null);

    const result = await service.exchangeCodeForToken('code_ts', '');
    expect(result.domain).toBe('default');
    expect(result.expiresAt).toBe(timestampSec * 1000);
  });
});
