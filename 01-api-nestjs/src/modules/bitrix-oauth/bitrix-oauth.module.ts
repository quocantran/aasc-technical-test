import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BitrixTokenEntity } from './entities/bitrix-token.entity';
import { BitrixOAuthService } from './services/bitrix-oauth.service';
import { BitrixApiService } from './services/bitrix-api.service';
import { BitrixOAuthController } from './controllers/bitrix-oauth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BitrixTokenEntity]),
    HttpModule,
    ConfigModule,
  ],
  controllers: [BitrixOAuthController],
  providers: [BitrixOAuthService, BitrixApiService],
  exports: [BitrixOAuthService, BitrixApiService],
})
export class BitrixOAuthModule {}
