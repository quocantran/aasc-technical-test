import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'game-server-jwt-super-secret-key-2026',
      ),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userModel.findById(payload.sub).lean().exec();
    if (!user) {
      throw new UnauthorizedException('Tài khoản người dùng không tồn tại hoặc đã bị xóa');
    }
    return {
      userId: payload.sub,
      username: user.username,
      email: user.email,
      nickname: user.nickname || user.username,
    };
  }
}
