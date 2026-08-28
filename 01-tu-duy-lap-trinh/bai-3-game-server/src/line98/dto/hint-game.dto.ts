import { IsNotEmpty, IsString } from 'class-validator';

export class HintGameDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;
}
