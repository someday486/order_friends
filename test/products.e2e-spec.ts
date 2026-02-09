import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Products (e2e)', () => {
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

  describe('/admin/products (GET)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/products?branchId=test-branch')
        .expect(401);
    });

    it('should return 400 without branchId', () => {
      return request(app.getHttpServer())
        .get('/admin/products')
        .set('Authorization', 'Bearer test-token')
        .expect(400);
    });
  });

  describe('/admin/products/:productId (GET)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/admin/products/test-product-id')
        .expect(401);
    });
  });

  describe('/admin/products (POST)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/admin/products')
        .send({
          branchId: 'test-branch',
          name: 'Test Product',
          price: 10000,
        })
        .expect(401);
    });

    it('should return 400 with invalid data', () => {
      return request(app.getHttpServer())
        .post('/admin/products')
        .set('Authorization', 'Bearer test-token')
        .send({
          // Missing required fields
          name: 'Test Product',
        })
        .expect(400);
    });
  });

  describe('/admin/products/:productId (PATCH)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .patch('/admin/products/test-product-id')
        .send({ name: 'Updated Product' })
        .expect(401);
    });
  });

  describe('/admin/products/:productId (DELETE)', () => {
    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .delete('/admin/products/test-product-id')
        .expect(401);
    });
  });
});
