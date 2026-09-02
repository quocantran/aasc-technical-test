import { ApiProperty } from '@nestjs/swagger';
import { Task } from '../task.schema';

export class PaginatedTaskResponseDto {
  @ApiProperty({ type: [Task], description: 'List of tasks for the current page' })
  data: Task[];

  @ApiProperty({ example: 100, description: 'Total number of tasks' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 20, description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ example: 5, description: 'Total number of pages' })
  totalPages: number;
}
