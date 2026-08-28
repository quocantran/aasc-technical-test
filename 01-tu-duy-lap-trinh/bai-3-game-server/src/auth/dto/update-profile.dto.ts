import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Địa chỉ Email',
    example: 'player1@gmail.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Biệt danh hiển thị (2-30 ký tự)',
    example: 'MasterCaro99',
  })
  @IsOptional()
  @IsString({ message: 'Biệt danh phải là chuỗi ký tự' })
  @MinLength(2, { message: 'Biệt danh phải có ít nhất 2 ký tự' })
  @MaxLength(30, { message: 'Biệt danh không được vượt quá 30 ký tự' })
  nickname?: string;
}
