import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CaroGameDocument = HydratedDocument<CaroGame>;

export interface PlayerInfo {
  userId: string;
  username: string;
  nickname: string;
}

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
export class CaroGame {
  @Prop({ required: true, unique: true, index: true })
  gameId: string;

  @Prop({ type: [[Number]], required: true })
  board: number[][]; // 15x15 (0: empty, 1: X, 2: O)

  @Prop({ type: Object, required: true })
  playerX: PlayerInfo;

  @Prop({ type: Object, default: null })
  playerO: PlayerInfo | null;

  @Prop({ type: String, enum: ['X', 'O'], default: 'X' })
  currentTurn: 'X' | 'O';

  @Prop({ type: String, default: null })
  winner: string | null; // userId or 'draw'

  @Prop({
    type: String,
    enum: ['waiting', 'playing', 'finished', 'cancelled'],
    default: 'waiting',
    index: true,
  })
  status: 'waiting' | 'playing' | 'finished' | 'cancelled';

  @Prop({ type: Number, default: 0 })
  moveCount: number;

  @Prop({ type: Object, default: null })
  lastMove: { row: number; col: number; player: 'X' | 'O' } | null;
}

export const CaroGameSchema = SchemaFactory.createForClass(CaroGame);

// Compound indexes for common query patterns
// (status + playerX.userId) — used by: findOrCreateMatch, handleDisconnect, getActiveGame
CaroGameSchema.index({ status: 1, 'playerX.userId': 1 });
// (status + playerO.userId) — used by: handleDisconnect (opponent lookup)
CaroGameSchema.index({ status: 1, 'playerO.userId': 1 });
