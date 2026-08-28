import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PlayerInfo } from './caro-game.schema';

export type CaroMatchHistoryDocument = HydratedDocument<CaroMatchHistory>;

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      delete (ret as Record<string, unknown>)._id;
      return ret;
    },
  },
})
export class CaroMatchHistory {
  @Prop({ required: true, unique: true, index: true })
  gameId: string;

  @Prop({ type: Object, required: true })
  playerX: PlayerInfo;

  @Prop({ type: Object, required: true })
  playerO: PlayerInfo;

  @Prop({ required: true })
  winner: string; // userId or 'draw'

  @Prop({ required: true })
  winnerName: string; // nickname/username or 'Draw'

  @Prop({ type: String, default: 'normal' })
  reason: 'win' | 'draw' | 'opponent_disconnected';

  @Prop({ required: true, default: 0 })
  totalMoves: number;

  @Prop({ required: true, default: 0 })
  durationSeconds: number;
}

export const CaroMatchHistorySchema =
  SchemaFactory.createForClass(CaroMatchHistory);
