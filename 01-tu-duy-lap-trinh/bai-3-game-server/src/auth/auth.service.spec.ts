import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserModel: any;
  let mockJwtService: any;

  const mockUserDoc = {
    _id: '507f1f77bcf86cd799439011',
    username: 'testplayer',
    password: '$2b$10$hashedpasswordstring',
    email: 'test@example.com',
    nickname: 'ProGamer',
    createdAt: new Date('2026-08-28T00:00:00.000Z'),
  };

  beforeEach(async () => {
    function mockConstructor(this: any, dto: any) {
      this._id = '507f1f77bcf86cd799439011';
      this.username = dto.username;
      this.password = dto.password;
      this.nickname = dto.nickname ?? dto.username;
      this.email = dto.email ?? '';
      this.createdAt = new Date('2026-08-28T00:00:00.000Z');
      this.save = jest.fn().mockResolvedValue(this);
    }

    mockConstructor.findOne = jest.fn();
    mockConstructor.findById = jest.fn();
    mockConstructor.findByIdAndUpdate = jest.fn();

    mockUserModel = mockConstructor;

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('2. should successfully register a new user with hashed password', async () => {
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.register({
        username: 'newuser',
        password: 'password123',
      });

      expect(result).toBeDefined();
      expect(result.username).toBe('newuser');
      expect((result as any).password).toBeUndefined();
    });

    it('3. should throw ConflictException if username already exists', async () => {
      mockUserModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUserDoc),
        }),
      });

      await expect(
        service.register({
          username: 'testplayer',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('4. should authenticate valid credentials and return JWT token', async () => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      });

      const result = await service.login({
        username: 'testplayer',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.username).toBe('testplayer');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('5. should throw UnauthorizedException on wrong password', async () => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUserDoc),
      });

      await expect(
        service.login({
          username: 'testplayer',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('6. should throw UnauthorizedException if username not found', async () => {
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.login({
          username: 'nonexistent',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile & updateProfile', () => {
    it('7. should return user profile details', async () => {
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockUserDoc),
        }),
      });

      const profile = await service.getProfile(mockUserDoc._id);
      expect(profile.username).toBe('testplayer');
      expect(profile.nickname).toBe('ProGamer');
    });

    it('8. should update profile fields', async () => {
      const updatedDoc = {
        ...mockUserDoc,
        nickname: 'SuperMaster',
        email: 'newemail@example.com',
      };

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedDoc),
        }),
      });

      const result = await service.updateProfile(mockUserDoc._id, {
        nickname: 'SuperMaster',
        email: 'newemail@example.com',
      });

      expect(result.nickname).toBe('SuperMaster');
      expect(result.email).toBe('newemail@example.com');
    });

    it('9. should throw NotFoundException if updating non-existent user', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.updateProfile('invalid-id', { nickname: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
