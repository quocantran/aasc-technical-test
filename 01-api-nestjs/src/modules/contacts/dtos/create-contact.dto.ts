import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BankDetailDto } from './bank-detail.dto';

/**
 * Data Transfer Object for creating a Contact with optional Requisite and Bank Details.
 */
export class CreateContactDto {
  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Tên của Contact (NAME)',
  })
  @IsNotEmpty({ message: 'Tên không được để trống' })
  @IsString({ message: 'Tên phải là chuỗi ký tự' })
  name: string;

  @ApiPropertyOptional({
    example: 'Nguyễn',
    description: 'Họ của Contact (LAST_NAME)',
  })
  @IsOptional()
  @IsString({ message: 'Họ phải là chuỗi ký tự' })
  lastName?: string;

  @ApiPropertyOptional({
    example: '123 Lê Lợi, Phường Bến Nghé',
    description: 'Địa chỉ đường phố (ADDRESS)',
  })
  @IsOptional()
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  address?: string;

  @ApiPropertyOptional({
    example: 'Quận 1',
    description: 'Quận / Huyện (ADDRESS_CITY)',
  })
  @IsOptional()
  @IsString({ message: 'Quận/Huyện phải là chuỗi ký tự' })
  city?: string;

  @ApiPropertyOptional({
    example: 'Hồ Chí Minh',
    description: 'Tỉnh / Thành phố (ADDRESS_PROVINCE)',
  })
  @IsOptional()
  @IsString({ message: 'Tỉnh/Thành phố phải là chuỗi ký tự' })
  province?: string;

  @ApiPropertyOptional({
    example: 'Việt Nam',
    description: 'Quốc gia (ADDRESS_COUNTRY)',
    default: 'Việt Nam',
  })
  @IsOptional()
  @IsString({ message: 'Quốc gia phải là chuỗi ký tự' })
  country?: string;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Số điện thoại liên hệ (PHONE)',
  })
  @IsOptional()
  @Matches(/^(\+84|0)[3|5|7|8|9][0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ (ví dụ: 0912345678 hoặc +84912345678)',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'vana@example.com',
    description: 'Địa chỉ Email (EMAIL)',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ (ví dụ: name@domain.com)' })
  email?: string;

  @ApiPropertyOptional({
    example: 'https://company.com',
    description: 'Trang web (WEB)',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Website không đúng định dạng URL hợp lệ' })
  website?: string;

  @ApiPropertyOptional({
    type: BankDetailDto,
    description: 'Thông tin tài khoản ngân hàng',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankDetailDto)
  bankDetail?: BankDetailDto;
}
