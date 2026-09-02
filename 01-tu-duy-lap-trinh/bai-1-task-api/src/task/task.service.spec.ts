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
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  };

  beforeEach(async () => {
    // Mock constructor and methods for Mongoose Model reflecting schema defaults
    function mockModelConstructor(this: any, dto: any) {
      this.id = dto.id ?? 'mock-generated-uuid';
      this.title = dto.title;
      this.description = dto.description ?? '';
      this.status = dto.status ?? TaskStatus.TODO;
      this.createdAt = dto.createdAt ?? new Date('2026-08-27T00:00:00.000Z');
      this.updatedAt = dto.updatedAt ?? new Date('2026-08-27T00:00:00.000Z');
      this.save = jest.fn().mockResolvedValue({
        id: this.id,
        title: this.title,
        description: this.description,
        status: this.status,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      });
    }

    mockModelConstructor.find = jest.fn();
    mockModelConstructor.countDocuments = jest.fn();
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
    // Test Case 4: Retrieve paginated tasks with defaults
    it('4. should return paginated tasks sorted by createdAt descending with default pagination', async () => {
      const mockTaskList = [mockTask, { ...mockTask, id: 'uuid-2', title: 'Task 2' }];

      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockTaskList),
              }),
            }),
          }),
        }),
      });
      mockTaskModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      });

      const result = await service.findAll();

      expect(mockTaskModel.find).toHaveBeenCalled();
      expect(mockTaskModel.countDocuments).toHaveBeenCalled();
      expect(result.data).toEqual(mockTaskList);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    // Test Case 5: Retrieve paginated tasks with custom page and limit
    it('5. should handle custom page and limit pagination options', async () => {
      const mockTaskList = [mockTask];

      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockTaskList),
              }),
            }),
          }),
        }),
      });
      mockTaskModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(25),
      });

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result.data).toEqual(mockTaskList);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
    });

    // Test Case 5b: Return totalPages as 1 when total is 0 (empty list)
    it('5b. should return totalPages as 1 when total database count is 0', async () => {
      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });
      mockTaskModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
    });

    // Test Case 5c: Fallback to defaults when page and limit are invalid (<= 0 or not integer)
    it('5c. should fallback to defaults when page or limit are invalid or negative', async () => {
      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([mockTask]),
              }),
            }),
          }),
        }),
      });
      mockTaskModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: -5, limit: 0 });

      expect(result.page).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    // Test Case 5d: Cap limit at 100 when requested limit exceeds maximum
    it('5d. should cap limit at 100 when requested limit exceeds 100', async () => {
      mockTaskModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue([mockTask]),
              }),
            }),
          }),
        }),
      });
      mockTaskModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(150),
      });

      const result = await service.findAll({ page: 1, limit: 500 });

      expect(result.limit).toBe(100);
      expect(result.totalPages).toBe(2);
    });
  });

  describe('findOne', () => {
    // Test Case 6: Find task by UUID successfully
    it('6. should return a task when valid UUID is provided', async () => {
      mockTaskModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockTask),
        }),
      });

      const result = await service.findOne(mockTask.id);

      expect(mockTaskModel.findOne).toHaveBeenCalledWith({ id: mockTask.id });
      expect(result).toEqual(mockTask);
    });

    // Test Case 7: Throw NotFoundException when UUID not found
    it('7. should throw NotFoundException when task with UUID does not exist', async () => {
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
    // Test Case 8: Update task fields successfully
    it('8. should update task title and status successfully', async () => {
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

    // Test Case 9: Throw NotFoundException when updating non-existent task
    it('9. should throw NotFoundException when updating non-existent task', async () => {
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
    // Test Case 10: Delete task successfully
    it('10. should delete a task and return success message with ID', async () => {
      mockTaskModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTask),
      });

      const result = await service.remove(mockTask.id);

      expect(mockTaskModel.findOneAndDelete).toHaveBeenCalledWith({
        id: mockTask.id,
      });
      expect(result).toEqual({
        message: 'Task deleted successfully',
        id: mockTask.id,
      });
    });

    // Test Case 11: Throw NotFoundException when deleting non-existent task
    it('11. should throw NotFoundException when deleting non-existent task', async () => {
      mockTaskModel.findOneAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('non-existent-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
