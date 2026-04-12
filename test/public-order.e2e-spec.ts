import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Public Order (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/public/orders (POST)', () => {
    it('should reject unauthenticated public order creation requests', () => {
      return request(app.getHttpServer())
        .post('/public/orders')
        .send({
          branchId: 'test-branch',
          customerName: '홍길동',
          items: [],
        })
        .expect(401);
    });

    it('should reject invalid bearer tokens for public order creation', () => {
      return request(app.getHttpServer())
        .post('/public/orders')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          branchId: 'test-branch',
          customerName: '홍길동',
          items: [],
        })
        .expect(401);
    });
  });

  describe('/public/shop/brands/:brandSlug/orders (POST)', () => {
    it('should reject unauthenticated shop order creation requests', () => {
      return request(app.getHttpServer())
        .post('/public/shop/brands/test-brand/orders')
        .send({
          customerName: '홍길동',
          items: [],
        })
        .expect(401);
    });

    it('should reject invalid bearer tokens for shop order creation', () => {
      return request(app.getHttpServer())
        .post('/public/shop/brands/test-brand/orders')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          customerName: '홍길동',
          items: [],
        })
        .expect(401);
    });
  });
});
