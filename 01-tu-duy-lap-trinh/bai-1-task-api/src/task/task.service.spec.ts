import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TaskService } from './task.service';
import { Task } from './task.schema';
import { TaskStatus } from './enums/task-status.enum';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

describe('TaskService', () => {
  let service: TaskService;
  let mockTaskModel: any;

  const mockTask = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'Learn NestJS and Mongoose',
    description: 'Build RESTful API following MVC architecture',
    status: TaskStatus.TODO,
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
  };

  beforeEach(async () => {
    // Mock constructor and methods for Mongoose Model reflecting schema defaults
    function mockModelConstructor(this: any, dto: any) {
      this.id = dto.id ?? 'mock-generated-uuid';
      this.title = dto.title;
      this.description = dto.description ?? '';
      this.status = dto.status ?? TaskStatus.TODO;
      this.createdAt = dto.createdAt ?? new Date('2026-08-27T00:00:00.000Z');
      this.save = jest.fn().mockResolvedValue({
        id: this.id,
        title: this.title,
        description: this.description,
        status: this.status,
        createdAt: this.createdAt,
      });
    }

    mockModelConstructor.find = jest.fn();
    mockModelConstructor.findOne = jest.fn();
    mockModelConstructor.findOneAndUpdate = jest.fn();
    mockModelConstructor.findOneAndDelete = jest.fn();

    mockTaskModel = mockModelConstructor;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: getModelToken(Task.name),
          useValue: mockTaskModel,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test Case 1: Service definition
  it('1. should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    // Test Case 2: Create task with default "To Do" status
    it('2. should create a new task with generated UUID and default "To Do" status', async () => {
      const dto: CreateTaskDto = {
        title: 'New task without status',
        description: 'Sample description',
      };

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.title).toEqual(dto.title);
      expect(result.description).toEqual(dto.description);
      expect(result.status).toEqual(TaskStatus.TODO);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    // Test Case 3: Create task with custom status
    it('3. should create a task with custom status when specified', async () => {
      const dto: CreateTaskDto = {
        title: 'Task in progress',
        status: TaskStatus.IN_PROGRESS,
      };

      const result = await service.create(dto);

      expect(result.status).toEqual(TaskStatus.IN_PROGRESS);
    });
  });

  describe('findAll', () => {
    // Test Case 4: Retrieve all tasks
    it('4. should return array of tasks sorted by createdAt descending', async () => {
      const mockTaskList = [mockTask, { ...mockTask, id: 'uuid-2', title: 'Task 2' }];

      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockTaskList),
          }),
        }),
      });

      const result = await service.findAll();

      expect(mockTaskModel.find).toHaveBeenCalled();
      expect(result).toEqual(mockTaskList);
      expect(result.length).toBe(2);
    });
  });

  describe('findOne', () => {
    // Test Case 5: Find task by UUID successfully
    it('5. should return a task when valid UUID is provided', async () => {
      mockTaskModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTask),
        }),
      });

      const result = await service.findOne(mockTask.id);

      expect(mockTaskModel.findOne).toHaveBeenCalledWith({ id: mockTask.id });
      expect(result).toEqual(mockTask);
    });

    // Test Case 6: Throw NotFoundException when UUID not found
    it('6. should throw NotFoundException when task with UUID does not exist', async () => {
      mockTaskModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.findOne('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    // Test Case 7: Update task fields successfully
    it('7. should update task title and status successfully', async () => {
      const updateDto: UpdateTaskDto = {
        title: 'Updated task title',
        status: TaskStatus.DONE,
      };

      const updatedMockTask = { ...mockTask, ...updateDto };

      mockTaskModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedMockTask),
        }),
      });

      const result = await service.update(mockTask.id, updateDto);

      expect(mockTaskModel.findOneAndUpdate).toHaveBeenCalledWith(
        { id: mockTask.id },
        { $set: updateDto },
        { new: true, runValidators: true },
      );
      expect(result.title).toEqual('Updated task title');
      expect(result.status).toEqual(TaskStatus.DONE);
    });

    // Test Case 8: Throw NotFoundException when updating non-existent task
    it('8. should throw NotFoundException when updating non-existent task', async () => {
      mockTaskModel.findOneAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.update('non-existent-uuid', { title: 'Update' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    // Test Case 9: Delete task successfully
    it('9. should delete a task and return success message with ID', async () => {
      mockTaskModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTask),
      });

      const result = await service.remove(mockTask.id);

      expect(mockTaskModel.findOneAndDelete).toHaveBeenCalledWith({
        id: mockTask.id,
      });
      expect(result).toEqual({
        message: `Task with ID ${mockTask.id} deleted successfully`,
        id: mockTask.id,
      });
    });

    // Test Case 10: Throw NotFoundException when deleting non-existent task
    it('10. should throw NotFoundException when deleting non-existent task', async () => {
      mockTaskModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
