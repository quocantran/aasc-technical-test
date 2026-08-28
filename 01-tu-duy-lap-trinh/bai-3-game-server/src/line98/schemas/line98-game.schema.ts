import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type Line98GameDocument = HydratedDocument<Line98Game>;

export type GameStatus = 'playing' | 'gameover';

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
export class Line98Game {
  @Prop({ required: true, unique: true, index: true })
  gameId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ type: [[Number]], required: true })
  board: number[][]; // 9x9 array (0: empty, 1-5: colors)

  @Prop({ required: true, default: 0 })
  score: number;

  @Prop({ type: [Number], required: true })
  nextBalls: number[]; // 3 colors preview

  @Prop({ type: String, enum: ['playing', 'gameover'], default: 'playing' })
  status: GameStatus;
}

export const Line98GameSchema = SchemaFactory.createForClass(Line98Game);
