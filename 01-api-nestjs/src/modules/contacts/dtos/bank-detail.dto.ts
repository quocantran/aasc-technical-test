import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object for bank account details associated with a Contact.
 */
export class BankDetailDto {
  @ApiProperty({
    example: 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
    description: 'Tên ngân hàng (RQ_BANK_NAME)',
  })
  @IsNotEmpty({ message: 'Tên ngân hàng không được để trống' })
  @IsString({ message: 'Tên ngân hàng phải là chuỗi ký tự' })
  bankName: string;

  @ApiProperty({
    example: '0071001234567',
    description: 'Số tài khoản ngân hàng (RQ_ACC_NUM)',
  })
  @IsNotEmpty({ message: 'Số tài khoản ngân hàng không được để trống' })
  @IsString({ message: 'Số tài khoản ngân hàng phải là chuỗi ký tự' })
  accountNumber: string;

  @ApiPropertyOptional({
    example: 'BFTVVNVX',
    description: 'Mã ngân hàng / BIK / SWIFT (RQ_BIK)',
  })
  @IsOptional()
  @IsString({ message: 'Mã ngân hàng (BIK) phải là chuỗi ký tự' })
  bik?: string;
}
