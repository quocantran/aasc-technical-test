import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Data Transfer Object for query pagination parameters.
 */
export class ContactQueryDto {
  @ApiPropertyOptional({
    description: 'Số trang cần lấy (bắt đầu từ 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang (page) phải là số nguyên' })
  @Min(1, { message: 'Số trang (page) tối thiểu là 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng bản ghi trên một trang (tối đa 50)',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng bản ghi (limit) phải là số nguyên' })
  @Min(1, { message: 'Số lượng bản ghi (limit) tối thiểu là 1' })
  @Max(50, { message: 'Số lượng bản ghi (limit) tối đa là 50' })
  limit?: number = 20;
}
