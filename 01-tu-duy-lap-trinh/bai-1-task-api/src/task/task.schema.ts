import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TaskStatus } from './enums/task-status.enum';

export type TaskDocument = HydratedDocument<Task>;

@Schema({
  timestamps: false,
  versionKey: false,
  toJSON: {
    transform: (_, ret) => {
      delete (ret as Record<string, unknown>)._id;
      return ret;
    },
  },
})
export class Task {
  @ApiProperty({
    description: 'Unique UUID identifier',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @ApiProperty({
    description: 'Task title',
    example: 'Build RESTful API with NestJS',
  })
  @Prop({ required: true, trim: true })
  title: string;

  @ApiProperty({
    description: 'Detailed description',
    example: 'Implement CRUD endpoints and connect MongoDB',
  })
  @Prop({ default: '', trim: true })
  description: string;

  @ApiProperty({
    description: 'Task status',
    enum: TaskStatus,
    example: TaskStatus.TODO,
  })
  @Prop({
    type: String,
    enum: Object.values(TaskStatus),
    default: TaskStatus.TODO,
  })
  status: TaskStatus;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-08-27T15:00:00.000Z',
  })
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
