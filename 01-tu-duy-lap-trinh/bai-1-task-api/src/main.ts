import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Set global API prefix for versioning, excluding Swagger docs
  app.setGlobalPrefix('api/v1', {
    exclude: ['docs', 'docs/(.*)'],
  });

  // Global validation pipe with strict whitelist
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  app.enableCors();

  // Setup Swagger OpenAPI documentation on /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Task Management API')
    .setDescription('RESTful API for task management using NestJS and MongoDB')
    .setVersion('1.0.0')
    .addTag('Tasks', 'CRUD operations for Task entity')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Task API Documentation',
  });

  await app.listen(port);

  logger.log(`Server is running at: http://localhost:${port}/api/v1`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/docs`);
}

bootstrap();
