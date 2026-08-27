import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskStatus } from '../enums/task-status.enum';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Task title (required, non-empty)',
    example: 'Build RESTful API with NestJS',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Title must not be empty' })
  @IsString({ message: 'Title must be a string' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  title: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the task',
    example: 'Implement CRUD endpoints and connect MongoDB database',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Current status of the task',
    enum: TaskStatus,
    default: TaskStatus.TODO,
    example: TaskStatus.TODO,
  })
  @IsOptional()
  @IsEnum(TaskStatus, {
    message: 'Status must be one of: "To Do", "In Progress", "Done"',
  })
  status?: TaskStatus;
}
