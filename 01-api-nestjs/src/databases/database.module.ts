import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configures TypeORM with SQLite storage for persistent OAuth tokens.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbPath = configService.get<string>(
          'app.databasePath',
          'data/tokens.sqlite',
        );
        const resolvedPath = path.resolve(process.cwd(), dbPath);
        const dir = path.dirname(resolvedPath);

        // Ensure database directory exists before connecting
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        return {
          type: 'sqlite',
          database: resolvedPath,
          autoLoadEntities: true,
          synchronize:
            configService.get<string>('app.nodeEnv') !== 'production', // Only auto-sync schema in development/test
          logging:
            configService.get<string>('app.nodeEnv') === 'development'
              ? ['error', 'warn']
              : false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
