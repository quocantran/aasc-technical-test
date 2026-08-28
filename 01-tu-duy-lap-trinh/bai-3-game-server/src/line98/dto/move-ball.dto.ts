import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PositionDto {
  @IsInt()
  @Min(0)
  @Max(8)
  row: number;

  @IsInt()
  @Min(0)
  @Max(8)
  col: number;
}

export class MoveBallDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PositionDto)
  from: PositionDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PositionDto)
  to: PositionDto;
}
