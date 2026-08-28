import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ username: dto.username }).lean().exec();
    if (existing) {
      throw new ConflictException(`Tên tài khoản '${dto.username}' đã tồn tại`);
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    const user = new this.userModel({
      username: dto.username,
      password: hashedPassword,
      nickname: dto.username,
      email: '',
    });

    const savedUser = await user.save();

    return {
      userId: savedUser._id.toString(),
      username: savedUser.username,
      nickname: savedUser.nickname,
      email: savedUser.email,
      createdAt: savedUser.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ username: dto.username }).exec();
    if (!user) {
      throw new UnauthorizedException('Tên tài khoản hoặc mật khẩu không chính xác');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Tên tài khoản hoặc mật khẩu không chính xác');
    }

    const payload = {
      sub: user._id.toString(),
      username: user.username,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        userId: user._id.toString(),
        username: user.username,
        nickname: user.nickname || user.username,
        email: user.email,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      userId: user._id.toString(),
      username: user.username,
      nickname: user.nickname || user.username,
      email: user.email,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: Partial<User> = {};
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;

    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true })
      .lean()
      .exec();

    if (!updated) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      userId: updated._id.toString(),
      username: updated.username,
      nickname: updated.nickname || updated.username,
      email: updated.email,
      updatedAt: (updated as any).updatedAt,
    };
  }
}
