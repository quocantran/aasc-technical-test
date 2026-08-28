import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaroGame, CaroGameSchema } from './schemas/caro-game.schema';
import {
  CaroMatchHistory,
  CaroMatchHistorySchema,
} from './schemas/caro-match-history.schema';
import { CaroService } from './caro.service';
import { CaroGateway } from './caro.gateway';
import { CaroController } from './caro.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaroGame.name, schema: CaroGameSchema },
      { name: CaroMatchHistory.name, schema: CaroMatchHistorySchema },
    ]),
    AuthModule,
  ],
  controllers: [CaroController],
  providers: [CaroService, CaroGateway],
  exports: [CaroService],
})
export class CaroModule {}
