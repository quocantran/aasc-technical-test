import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedTaskResponseDto } from './dto/paginated-task-response.dto';
import { Task } from './task.schema';

@ApiTags('Tasks')
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({
    status: 201,
    description: 'Task created successfully',
    type: Task,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    return await this.taskService.create(createTaskDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve paginated list of tasks' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of tasks',
    type: PaginatedTaskResponseDto,
  })
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedTaskResponseDto> {
    return await this.taskService.findAll(query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve a single task by ID' })
  @ApiParam({
    name: 'id',
    description: 'Task UUID identifier (Version 4)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Task details',
    type: Task,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Parameter is not a valid UUID v4',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<Task> {
    return await this.taskService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a task by ID (PATCH)' })
  @ApiParam({
    name: 'id',
    description: 'Task UUID identifier (Version 4)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiBody({ type: UpdateTaskDto })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully',
    type: Task,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid UUID v4 or invalid body input data',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    return await this.taskService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task by ID' })
  @ApiParam({
    name: 'id',
    description: 'Task UUID identifier (Version 4)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Task deleted successfully',
    schema: {
      example: {
        message: 'Task deleted successfully',
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Parameter is not a valid UUID v4',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<{ message: string; id: string }> {
    return await this.taskService.remove(id);
  }
}
