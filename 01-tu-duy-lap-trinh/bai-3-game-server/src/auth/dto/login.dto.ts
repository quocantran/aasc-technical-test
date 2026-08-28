import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Tên tài khoản',
    example: 'player1',
  })
  @IsString({ message: 'Tên tài khoản phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên tài khoản không được để trống' })
  username: string;

  @ApiProperty({
    description: 'Mật khẩu',
    example: 'secret123',
  })
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  password: string;
}
