import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateContactDto } from './create-contact.dto';
import { BankDetailDto } from './bank-detail.dto';

/**
 * Data Transfer Object for updating an existing Contact and its bank details.
 */
export class UpdateContactDto extends PartialType(CreateContactDto) {
  @ApiPropertyOptional({
    type: BankDetailDto,
    nullable: true,
    description:
      'Thông tin tài khoản ngân hàng (truyền null nếu muốn xóa bỏ hồ sơ ngân hàng)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankDetailDto)
  bankDetail?: BankDetailDto | null;
}
