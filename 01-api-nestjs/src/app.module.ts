import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './configs/app.config';
import { DatabaseModule } from './databases/database.module';
import { BitrixOAuthModule } from './modules/bitrix-oauth/bitrix-oauth.module';
import { ContactsModule } from './modules/contacts/contacts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    BitrixOAuthModule,
    ContactsModule,
  ],
})
export class AppModule {}
