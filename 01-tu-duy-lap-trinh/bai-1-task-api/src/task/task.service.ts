import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Task, TaskDocument } from './task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { PaginatedTaskResponseDto } from './dto/paginated-task-response.dto';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<TaskDocument>,
  ) {}

  // Create a new task with generated UUID v4
  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const newTask = new this.taskModel({
      id: randomUUID(),
      ...createTaskDto,
    });

    return await newTask.save();
  }

  // Retrieve paginated tasks sorted by createdAt descending
  async findAll(query?: PaginationQueryDto): Promise<PaginatedTaskResponseDto> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.taskModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.taskModel.countDocuments().exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Find a single task by UUID
  async findOne(id: string): Promise<Task> {
    const task = await this.taskModel.findOne({ id }).lean().exec();
    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }
    return task;
  }

  // Update a task by UUID
  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const updatedTask = await this.taskModel
      .findOneAndUpdate(
        { id },
        { $set: updateTaskDto },
        { new: true, runValidators: true },
      )
      .lean()
      .exec();

    if (!updatedTask) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    return updatedTask;
  }

  // Delete a task by UUID
  async remove(id: string): Promise<{ message: string; id: string }> {
    const deletedTask = await this.taskModel.findOneAndDelete({ id }).exec();
    if (!deletedTask) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    return {
      message: 'Task deleted successfully',
      id,
    };
  }
}
