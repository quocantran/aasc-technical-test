import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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
    updatedAt: new Date('2026-08-28T00:00:00.000Z'),
  };

  beforeEach(async () => {
    function mockConstructor(this: any, dto: any) {
      this._id = '507f1f77bcf86cd799439011';
      this.username = dto.username;
      this.password = dto.password;
      this.nickname = dto.nickname ?? dto.username;
      this.email = dto.email ?? '';
      this.createdAt = new Date('2026-08-28T00:00:00.000Z');
      this.updatedAt = new Date('2026-08-28T00:00:00.000Z');
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
    it('4. should authenticate valid credentials and return JWT token with nickname', async () => {
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
      expect(result.user.nickname).toBe('ProGamer');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('4b. should fallback to username when nickname is empty in login', async () => {
      jest.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

      const userDocNoNickname = {
        ...mockUserDoc,
        nickname: '',
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userDocNoNickname),
      });

      const result = await service.login({
        username: 'testplayer',
        password: 'password123',
      });

      expect(result.user.nickname).toBe('testplayer');
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

    it('7b. should return profile with username fallback when nickname is empty', async () => {
      const docWithoutNickname = {
        ...mockUserDoc,
        nickname: '',
      };
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(docWithoutNickname),
        }),
      });

      const profile = await service.getProfile(mockUserDoc._id);
      expect(profile.nickname).toBe('testplayer');
    });

    it('7c. should throw NotFoundException when getting non-existent profile', async () => {
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('8. should update profile fields (both email and nickname)', async () => {
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

    it('8b. should update profile with single field and handle empty nickname fallback', async () => {
      const updatedDocNoNick = {
        ...mockUserDoc,
        nickname: '',
      };

      mockUserModel.findByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(updatedDocNoNick),
        }),
      });

      const result = await service.updateProfile(mockUserDoc._id, {});
      expect(result.nickname).toBe('testplayer');
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
