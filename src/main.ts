import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/nestjs';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

const logger = new Logger('Bootstrap');

function validateEnvironment(): void {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const missingVars: string[] = [];

    if (!process.env.TOSS_SECRET_KEY) {
      missingVars.push('TOSS_SECRET_KEY');
    }
    if (!process.env.SUPABASE_URL) {
      missingVars.push('SUPABASE_URL');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (!process.env.JWT_SECRET) {
      missingVars.push('JWT_SECRET');
    }

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables in production: ${missingVars.join(', ')}`,
      );
    }
  }

  // Non-production warnings
  if (!isProd) {
    if (!process.env.TOSS_SECRET_KEY) {
      logger.warn(
        'TOSS_SECRET_KEY not set — payment module will run in mock mode',
      );
    }
    if (!process.env.SENDGRID_API_KEY) {
      logger.warn(
        'SENDGRID_API_KEY not set — email notifications will run in mock mode',
      );
    }
    if (!process.env.SMS_API_KEY) {
      logger.warn(
        'SMS_API_KEY not set — SMS notifications will run in mock mode',
      );
    }
  }
}

async function bootstrap() {
  validateEnvironment();

  const configuredCorsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const isConfiguredOriginAllowed = (origin: string): boolean =>
    configuredCorsOrigins.some((allowedOrigin) => {
      if (allowedOrigin === origin) {
        return true;
      }

      // Support wildcard host patterns like https://*.vercel.app
      if (allowedOrigin.includes('*')) {
        const pattern = `^${allowedOrigin
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')}$`;
        return new RegExp(pattern).test(origin);
      }

      return false;
    });

  // Initialize Sentry (optional - requires SENTRY_DSN env var)
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 1.0,
    });
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    // 불필요한 파라미터 파싱 비활성화로 시작 오버헤드 감소
    bufferLogs: false,
  });

  // Request body size limit (10mb for file uploads, 1mb for general API)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use(require('express').json({ limit: '1mb' }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  // HTTP Keep-Alive 타임아웃 설정 (기본 5초 → 65초: 로드밸런서 타임아웃 대응)
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

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
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);

      // Allow localhost and common local/dev hosts
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }

      // Allow private network IPs in development
      if (
        process.env.NODE_ENV !== 'production' &&
        (origin.startsWith('http://192.168.') ||
          /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+:\d+$/.test(origin) ||
          origin.startsWith('http://10.'))
      ) {
        return callback(null, true);
      }

      if (isConfiguredOriginAllowed(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Order Friends API')
    .setDescription('메뉴보드 기반 브랜드/매장 관리 및 주문 시스템 API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '인증 및 권한 관리')
    .addTag('brands', '브랜드 관리')
    .addTag('branches', '지점 관리')
    .addTag('products', '상품 관리')
    .addTag('orders', '주문 관리')
    .addTag('members', '멤버 관리')
    .addTag('dashboard', '대시보드')
    .addTag('public', '공개 API')
    .addTag('health', '헬스 체크')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 4000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 4000}`,
  );
  console.log(
    `API Documentation: http://localhost:${process.env.PORT ?? 4000}/api-docs`,
  );
}

void bootstrap();
