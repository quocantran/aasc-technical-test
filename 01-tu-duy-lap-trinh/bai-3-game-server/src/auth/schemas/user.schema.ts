import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      delete (ret as Record<string, unknown>).password;
      delete (ret as Record<string, unknown>)._id;
      return ret;
    },
  },
})
export class User {
  @ApiProperty({
    description: 'Unique username for login',
    example: 'player1',
  })
  @Prop({ required: true, unique: true, index: true, trim: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @ApiProperty({
    description: 'User email address',
    example: 'player1@example.com',
    required: false,
  })
  @Prop({ default: '', trim: true })
  email: string;

  @ApiProperty({
    description: 'Display nickname',
    example: 'MasterCaro99',
    required: false,
  })
  @Prop({ default: '', trim: true })
  nickname: string;

  @ApiProperty({
    description: 'Account creation date',
    example: '2026-08-28T00:00:00.000Z',
  })
  createdAt?: Date;

  @ApiProperty({
    description: 'Account last updated date',
    example: '2026-08-28T00:00:00.000Z',
  })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
