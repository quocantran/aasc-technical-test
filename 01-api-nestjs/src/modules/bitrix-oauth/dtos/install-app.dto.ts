import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Inbound payload DTO received when a Local Application is installed on Bitrix24.
 */
export class InstallAppDto {
  @ApiPropertyOptional({
    description: 'Initial access token provided by Bitrix24',
  })
  @IsOptional()
  @IsString()
  AUTH_ID?: string;

  @ApiPropertyOptional({ description: 'Refresh token provided by Bitrix24' })
  @IsOptional()
  @IsString()
  REFRESH_ID?: string;

  @ApiPropertyOptional({ description: 'Access token lifetime in seconds' })
  @IsOptional()
  AUTH_EXPIRES?: string | number;

  @ApiPropertyOptional({
    description: 'Bitrix24 portal domain (e.g. b24-abc.bitrix24.vn)',
  })
  @IsOptional()
  @IsString()
  DOMAIN?: string;

  @ApiPropertyOptional({
    description: 'Unique member identifier of the Bitrix24 portal',
  })
  @IsOptional()
  @IsString()
  member_id?: string;

  @ApiPropertyOptional({
    description: 'Authorization code if using authorization code grant flow',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Application installation status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Nested auth object provided in modern Bitrix24 versions',
  })
  @IsOptional()
  auth?: {
    access_token?: string;
    refresh_token?: string;
    domain?: string;
    expires_in?: number;
    member_id?: string;
    scope?: string;
  };
}
