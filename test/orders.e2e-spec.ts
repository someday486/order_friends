import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Orders (e2e)', () => {
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

  describe('/admin/orders (GET)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/orders?branchId=test-branch')
        .expect(401);
    });

    it('should return 400 without branchId', () => {
      return request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', 'Bearer test-token')
        .expect(400);
    });
  });

  describe('/admin/orders/:orderId (GET)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/orders/test-order-id?branchId=test-branch')
        .expect(401);
    });

    it('should return 400 without branchId', () => {
      return request(app.getHttpServer())
        .get('/admin/orders/test-order-id')
        .set('Authorization', 'Bearer test-token')
        .expect(400);
    });
  });

  describe('/admin/orders/:orderId/status (PATCH)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .patch('/admin/orders/test-order-id/status?branchId=test-branch')
        .send({ status: 'CONFIRMED' })
        .expect(401);
    });

    it('should return 400 with invalid status', () => {
      return request(app.getHttpServer())
        .patch('/admin/orders/test-order-id/status?branchId=test-branch')
        .set('Authorization', 'Bearer test-token')
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });
});
