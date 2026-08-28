import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class MakeMoveDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsInt()
  @Min(0)
  @Max(14)
  row: number;

  @IsInt()
  @Min(0)
  @Max(14)
  col: number;
}
