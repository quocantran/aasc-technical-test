import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';

/**
 * Composite decorator: attaches ApiKeyGuard and documents the `x-api-key` header in Swagger.
 */
export function UseApiKeyAuth() {
  return applyDecorators(
    UseGuards(ApiKeyGuard),
    ApiHeader({
      name: 'x-api-key',
      description: 'Secret API key required for authentication',
      required: true,
      schema: {
        type: 'string',
        example: 'your-api-key-here',
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Authentication failed: Invalid or missing x-api-key header',
    }),
  );
}
