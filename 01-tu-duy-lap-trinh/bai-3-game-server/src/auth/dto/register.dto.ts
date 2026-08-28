import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Tên tài khoản đăng ký (3-20 ký tự)',
    example: 'player1',
    minLength: 3,
    maxLength: 20,
  })
  @IsString({ message: 'Tên tài khoản phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên tài khoản không được để trống' })
  @MinLength(3, { message: 'Tên tài khoản phải có ít nhất 3 ký tự' })
  @MaxLength(20, { message: 'Tên tài khoản không được vượt quá 20 ký tự' })
  username: string;

  @ApiProperty({
    description: 'Mật khẩu (tối thiểu 6 ký tự)',
    example: 'secret123',
    minLength: 6,
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;
}
