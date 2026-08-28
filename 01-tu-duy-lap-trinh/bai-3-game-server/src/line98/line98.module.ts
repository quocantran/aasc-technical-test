import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Line98Game, Line98GameSchema } from './schemas/line98-game.schema';
import { Line98Service } from './line98.service';
import { Line98Gateway } from './line98.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Line98Game.name, schema: Line98GameSchema },
    ]),
    AuthModule,
  ],
  providers: [Line98Service, Line98Gateway],
  exports: [Line98Service],
})
export class Line98Module {}
