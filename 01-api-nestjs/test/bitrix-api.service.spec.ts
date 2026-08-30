import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { BitrixApiService } from '../src/modules/bitrix-oauth/services/bitrix-api.service';
import { BitrixOAuthService } from '../src/modules/bitrix-oauth/services/bitrix-oauth.service';

describe('BitrixApiService', () => {
  let service: BitrixApiService;
  let mockHttpService: any;
  let mockOAuthService: any;
  let mockConfigService: any;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  const mockToken: any = {
    id: 1,
    domain: 'b24-test.bitrix24.vn',
    accessToken: 'valid_access_token_123',
    refreshToken: 'valid_refresh_token_456',
    expiresAt: Date.now() + 3600 * 1000,
  };

  beforeEach(async () => {
    mockHttpService = {
      post: jest.fn(),
    };

    mockOAuthService = {
      getValidToken: jest
        .fn()
        .mockImplementation(() => Promise.resolve(mockToken)),
      refreshToken: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...mockToken,
          accessToken: 'refreshed_access_token_999',
        }),
      ),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'app.bitrix24.apiTimeout') return 10000;
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BitrixApiService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: BitrixOAuthService,
          useValue: mockOAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BitrixApiService>(BitrixApiService);
  });

  it('1. callBitrixAPI() - should call correct REST API URL and return the `result` payload', async () => {
    const apiResponse = {
      data: {
        result: [{ ID: '142', NAME: 'John Doe' }],
        total: 1,
      },
    };

    mockHttpService.post.mockReturnValue(of(apiResponse));

    const result = await service.callBitrixAPI('crm.contact.list', {
      order: { ID: 'DESC' },
    });

    expect(result).toEqual([{ ID: '142', NAME: 'John Doe' }]);
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://b24-test.bitrix24.vn/rest/crm.contact.list.json',
      expect.objectContaining({
        auth: 'valid_access_token_123',
        order: { ID: 'DESC' },
      }),
      expect.any(Object),
    );
  });

  it('2. callBitrixAPI() - should automatically refresh token and retry on 401 / expired_token', async () => {
    const expiredError = {
      response: {
        status: HttpStatus.UNAUTHORIZED,
        data: {
          error: 'expired_token',
          error_description: 'The access token provided has expired',
        },
      },
    };

    const successResponse = {
      data: {
        result: 142,
      },
    };

    mockHttpService.post
      .mockReturnValueOnce(throwError(() => expiredError))
      .mockReturnValueOnce(of(successResponse));

    const result = await service.callBitrixAPI('crm.contact.add', {
      fields: { NAME: 'Test' },
    });

    expect(result).toBe(142);
    expect(mockOAuthService.refreshToken).toHaveBeenCalled();
    expect(mockHttpService.post).toHaveBeenCalledTimes(2);
  });

  it('3. callBitrixAPI() - should throw NotFoundException when Bitrix returns not found', async () => {
    const notFoundError = {
      response: {
        status: HttpStatus.NOT_FOUND,
        data: {
          error: 'ERROR_NOT_FOUND',
          error_description: 'Contact not found',
        },
      },
    };

    mockHttpService.post.mockReturnValue(throwError(() => notFoundError));

    await expect(
      service.callBitrixAPI('crm.contact.get', { id: 999 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. callBitrixAPI() - should throw ForbiddenException on access denied or insufficient scope', async () => {
    const forbiddenError = {
      response: {
        status: HttpStatus.FORBIDDEN,
        data: {
          error: 'ACCESS_DENIED',
          error_description: 'Access denied for scope crm',
        },
      },
    };

    mockHttpService.post.mockReturnValue(throwError(() => forbiddenError));

    await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('5. callBitrixAPI() - should throw BadRequestException on invalid payload or missing param', async () => {
    const badRequestError = {
      response: {
        status: HttpStatus.BAD_REQUEST,
        data: {
          error: 'ERROR_CORE',
          error_description: 'Field NAME is required',
        },
      },
    };

    mockHttpService.post.mockReturnValue(throwError(() => badRequestError));

    await expect(service.callBitrixAPI('crm.contact.add', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('6. callBitrixAPI() - should throw HttpException on generic 500 server error', async () => {
    const serverError = {
      response: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        data: {
          error: 'INTERNAL_SERVER_ERROR',
          error_description: 'Bitrix server fatal error',
        },
      },
    };

    mockHttpService.post.mockReturnValue(throwError(() => serverError));

    await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
      HttpException,
    );
  });

  it('7. callBitrixAPIWithPagination() - should return result array and total count', async () => {
    const apiResponse = {
      data: {
        result: [{ ID: '101', NAME: 'Alice' }],
        total: 101,
        next: 20,
      },
    };

    mockHttpService.post.mockReturnValue(of(apiResponse));

    const response = await service.callBitrixAPIWithPagination(
      'crm.contact.list',
      { start: 0 },
    );

    expect(response.result).toEqual([{ ID: '101', NAME: 'Alice' }]);
    expect(response.total).toBe(101);
    expect(response.next).toBe(20);
  });

  it('8. callBitrixAPIWithPagination() - should retry on expired token or NO_AUTH_FOUND', async () => {
    const expiredError = {
      response: {
        status: HttpStatus.UNAUTHORIZED,
        data: {
          error: 'NO_AUTH_FOUND',
          error_description: 'The access token provided has expired',
        },
      },
    };

    const successResponse = {
      data: {
        result: [{ ID: '102' }],
        total: 1,
      },
    };

    mockHttpService.post
      .mockReturnValueOnce(throwError(() => expiredError))
      .mockReturnValueOnce(of(successResponse));

    const response =
      await service.callBitrixAPIWithPagination('crm.contact.list');

    expect(response.total).toBe(1);
    expect(mockOAuthService.refreshToken).toHaveBeenCalled();
  });

  it('9. callBitrixAPI() - should throw when Bitrix returns 200 HTTP with error field in body', async () => {
    const errorInBody = {
      data: {
        error: 'QUERY_LIMIT_EXCEEDED',
        error_description: 'Too many requests',
      },
    };

    mockHttpService.post.mockReturnValue(of(errorInBody));

    await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
      HttpException,
    );
  });

  it('10. callBitrixAPIWithPagination() - should throw when Bitrix returns 200 HTTP with error field in body', async () => {
    const errorInBody = {
      data: {
        error: 'ERROR_PAGINATION',
        error_description: 'Invalid start param',
      },
    };

    mockHttpService.post.mockReturnValue(of(errorInBody));

    await expect(
      service.callBitrixAPIWithPagination('crm.contact.list'),
    ).rejects.toThrow(HttpException);
  });

  it('11. callBitrixAPIWithPagination() - should handle non-array result and missing total gracefully', async () => {
    const responseWithNullResult = {
      data: {
        result: null,
      },
    };

    mockHttpService.post.mockReturnValue(of(responseWithNullResult));

    const response =
      await service.callBitrixAPIWithPagination('crm.contact.list');

    expect(response.result).toEqual([]);
    expect(response.total).toBe(0);
  });

  it('12. callBitrixAPI() - should throw error when retry fails or isRetry is true', async () => {
    const expiredError = {
      response: {
        status: HttpStatus.UNAUTHORIZED,
        data: {
          error: 'expired_token',
          error_description: 'Token expired',
        },
      },
    };

    mockHttpService.post.mockReturnValue(throwError(() => expiredError));

    await expect(
      service.callBitrixAPI('crm.contact.list', {}, true),
    ).rejects.toThrow(HttpException);
  });

  it('13. callBitrixAPIWithPagination() - should throw error when isRetry is true on failure', async () => {
    const expiredError = {
      response: {
        status: HttpStatus.UNAUTHORIZED,
        data: {
          error: 'expired_token',
          error_description: 'Token expired',
        },
      },
    };

    mockHttpService.post.mockReturnValue(throwError(() => expiredError));

    await expect(
      service.callBitrixAPIWithPagination('crm.contact.list', {}, true),
    ).rejects.toThrow(HttpException);
  });

  it('14. handleBitrixError() - should handle textual error patterns without HTTP status', async () => {
    // Textual not exist -> NotFoundException
    mockHttpService.post.mockReturnValueOnce(
      throwError(() => new Error('Item does not exist')),
    );
    await expect(service.callBitrixAPI('crm.contact.get')).rejects.toThrow(
      NotFoundException,
    );

    // Textual access_denied -> ForbiddenException
    mockHttpService.post.mockReturnValueOnce(
      throwError(() => new Error('insufficient_scope for method')),
    );
    await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
      ForbiddenException,
    );

    // Textual is not defined / required -> BadRequestException
    mockHttpService.post.mockReturnValueOnce(
      throwError(() => new Error('Parameter is not defined')),
    );
    await expect(service.callBitrixAPI('crm.contact.add')).rejects.toThrow(
      BadRequestException,
    );

    // Generic error without status -> HttpException with BAD_GATEWAY (502)
    mockHttpService.post.mockReturnValueOnce(
      throwError(() => new Error('Connection reset by peer')),
    );
    try {
      await service.callBitrixAPI('crm.contact.list');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    }
  });

  describe('callBitrixBatch() and serializeBatchPayload()', () => {
    it('15. callBitrixBatch() - should execute batch commands successfully', async () => {
      const mockBatchResponse = {
        data: {
          result: {
            result: {
              add_contact: 101,
              add_requisite: 201,
            },
            result_error: {},
            result_total: {},
          },
        },
      };

      mockHttpService.post.mockReturnValue(of(mockBatchResponse));

      const res = await service.callBitrixBatch({
        add_contact: 'crm.contact.add?fields[NAME]=John',
        add_requisite:
          'crm.requisite.add?fields[ENTITY_ID]=$result[add_contact]',
      });

      expect(res.result).toEqual({
        add_contact: 101,
        add_requisite: 201,
      });
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'https://b24-test.bitrix24.vn/rest/batch.json',
        expect.objectContaining({
          halt: 0,
          auth: 'valid_access_token_123',
        }),
        expect.any(Object),
      );
    });

    it('16. callBitrixBatch() - should handle data.error in batch response', async () => {
      const mockErrorResponse = {
        data: {
          error: 'BATCH_LENGTH_EXCEEDED',
          error_description: 'Max 50 commands allowed',
        },
      };

      mockHttpService.post.mockReturnValue(of(mockErrorResponse));

      await expect(
        service.callBitrixBatch({
          cmd1: 'crm.contact.get?id=1',
        }),
      ).rejects.toThrow(HttpException);
    });

    it('17. callBitrixBatch() - should handle 401 token refresh retry', async () => {
      const expiredError = {
        response: {
          status: HttpStatus.UNAUTHORIZED,
          data: {
            error: 'expired_token',
          },
        },
      };

      const successBatchResponse = {
        data: {
          result: {
            result: { contact: { ID: 101 } },
          },
        },
      };

      mockHttpService.post
        .mockReturnValueOnce(throwError(() => expiredError))
        .mockReturnValueOnce(of(successBatchResponse));

      mockOAuthService.refreshToken.mockResolvedValueOnce({
        ...mockToken,
        accessToken: 'new_refreshed_token',
      });

      const res = await service.callBitrixBatch({
        contact: 'crm.contact.get?id=101',
      });

      expect(res.result).toEqual({ contact: { ID: 101 } });
      expect(mockOAuthService.refreshToken).toHaveBeenCalled();
    });

    it('18. callBitrixBatch() - should fail directly when isRetry is true', async () => {
      const expiredError = {
        response: {
          status: HttpStatus.UNAUTHORIZED,
          data: {
            error: 'expired_token',
          },
        },
      };

      mockHttpService.post.mockReturnValue(throwError(() => expiredError));

      await expect(
        service.callBitrixBatch({ contact: 'crm.contact.get?id=101' }, 0, true),
      ).rejects.toThrow(HttpException);
    });

    it('19. serializeBatchPayload() - should correctly serialize nested objects, arrays, and $result references', () => {
      const payload = {
        name: 'Nguyen Van A',
        age: 30,
        nested: {
          city: 'Hanoi',
        },
        tags: ['tag1', 'tag2'],
        phones: [{ value: '0912345678', type: 'WORK' }],
        refId: '$result[add_contact]',
        ignoredNull: null,
        ignoredUndefined: undefined,
      };

      const serialized = service.serializeBatchPayload(payload);

      expect(serialized).toContain('name=Nguyen%20Van%20A');
      expect(serialized).toContain('nested%5Bcity%5D=Hanoi');
      expect(serialized).toContain('tags%5B0%5D=tag1');
      expect(serialized).toContain('phones%5B0%5D%5Bvalue%5D=0912345678');
      expect(serialized).toContain('refId=$result[add_contact]');
      expect(serialized).not.toContain('ignoredNull');
      expect(serialized).not.toContain('ignoredUndefined');
    });
  });
});
