import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  // Set global API prefix for REST versioning
  app.setGlobalPrefix('api/v1', {
    exclude: ['docs', 'docs/(.*)', '', 'index.html', 'login.html', 'profile.html', 'line98.html', 'caro.html', 'css/(.*)', 'js/(.*)'],
  });

  // Global HTTP validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Setup Swagger OpenAPI documentation on /docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Game Server API — Line 98 & Caro')
    .setDescription(
      'RESTful & WebSocket Game Server using NestJS, MongoDB, and Socket.IO',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT access token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Account management endpoints')
    .addTag('Caro Game', 'Caro match endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Game Server API Documentation',
  });

  await app.listen(port);

  logger.log(`Server is running at: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/docs`);
  logger.log(`Line 98 Game UI: http://localhost:${port}/line98.html`);
  logger.log(`Caro Game UI: http://localhost:${port}/caro.html`);
}

bootstrap();
