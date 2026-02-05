// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 4000);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Helmet
  app.use(helmet());

  // Global Exception Filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Validation Pipe
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

  // CORS Configuration
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.0.74:3000',
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Order Friends API')
    .setDescription('멀티테넌트 기반 브랜드/매장 관리 및 주문 시스템 API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '인증 및 권한 관리')
    .addTag('brands', '브랜드 관리')
    .addTag('branches', '지점 관리')
    .addTag('products', '상품 관리')
    .addTag('orders', '주문 관리')
    .addTag('members', '멤버십 관리')
    .addTag('dashboard', '대시보드')
    .addTag('public', '공개 API')
    .addTag('health', '헬스체크')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
  console.log(`🚀 Application is running on: http://localhost:${process.env.PORT ?? 4000}`);
  console.log(`📚 API Documentation: http://localhost:${process.env.PORT ?? 4000}/api-docs`);
}

bootstrap();
