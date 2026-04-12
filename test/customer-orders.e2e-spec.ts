import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Customer Orders (e2e)', () => {
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

  describe('/customer/orders/:orderId/delivery-tracking (PATCH)', () => {
    it('should require authentication to update delivery tracking', () => {
      return request(app.getHttpServer())
        .patch('/customer/orders/test-order/delivery-tracking')
        .send({
          deliveryStatus: 'IN_TRANSIT',
          deliveryCarrier: 'Fast Courier',
          deliveryTrackingNumber: 'TRACK-123',
        })
        .expect(401);
    });

    it('should reject invalid authentication tokens for delivery tracking updates', () => {
      return request(app.getHttpServer())
        .patch('/customer/orders/test-order/delivery-tracking')
        .set('Authorization', 'Bearer test-token')
        .send({
          deliveryStatus: 'DELIVERED',
          deliveryCarrier: 'Fast Courier',
          deliveryTrackingNumber: 'TRACK-123',
        })
        .expect(401);
    });
  });
});
