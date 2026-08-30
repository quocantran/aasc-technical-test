import { Module } from '@nestjs/common';
import { ContactsController } from './controllers/contacts.controller';
import { ContactsService } from './services/contacts.service';
import { BitrixOAuthModule } from '../bitrix-oauth/bitrix-oauth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [BitrixOAuthModule, ConfigModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
