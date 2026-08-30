import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonLogger } from './loggers/winston.logger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Bootstrap entry point for the NestJS API Gateway application.
 */
async function bootstrap() {
  const winstonLogger = new WinstonLogger();

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  const configService = app.get(ConfigService);
  const corsOrigin = configService.get<string>('app.corsOrigin', '*');
  const port = configService.get<number>('app.port', 3000);

  // 1. Enable Cross-Origin Resource Sharing (CORS)
  app.enableCors({
    origin:
      corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization, x-api-key',
  });

  // 2. Global Validation Pipe with automatic payload transformation and stripping
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  // 3. Global HTTP exception filter for consistent error JSON format
  app.useGlobalFilters(new HttpExceptionFilter());

  // 4. Configure Swagger / OpenAPI documentation UI at `/docs`
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bitrix24 CRM Integration API Gateway')
    .setDescription(
      `NestJS v12 REST API integration connecting with Bitrix24 REST API via OAuth 2.0 Local Application.\n\n` +
        `### Key Features:\n` +
        `- **OAuth 2.0 Management:** Receives install event at \`/install\` and auto-renews tokens on expiration.\n` +
        `- **Contacts & Requisites CRUD:** Manages contacts and 3-tier bank details (Requisites & Bank Details).\n` +
        `- **Security:** All \`/contacts\` endpoints are protected with the \`x-api-key\` header.`,
    )
    .setVersion('1.0.0')
    .addTag(
      'OAuth 2.0',
      'Inbound install events and token lifecycle management',
    )
    .addTag(
      'Contacts & Requisites',
      '3-tier Contact and Bank Details management on Bitrix24 CRM',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Bitrix24 API Documentation - AASC Technical Test',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(port);

  winstonLogger.log(
    `NestJS Server running at: http://localhost:${port}`,
    'Bootstrap',
  );
  winstonLogger.log(
    `Swagger UI documentation: http://localhost:${port}/docs`,
    'Bootstrap',
  );
  winstonLogger.log(
    `OAuth Installation endpoint: http://localhost:${port}/install`,
    'Bootstrap',
  );
}

bootstrap();
