import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  type NestApplicationOptions,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  const originalWebhookSecret = process.env.TOSS_WEBHOOK_SECRET;
  const originalWebhookHeader = process.env.TOSS_WEBHOOK_SIGNATURE_HEADER;
  const originalWebhookMaxAge = process.env.TOSS_WEBHOOK_MAX_AGE_SECONDS;
  const webhookSecret = 'e2e-webhook-secret';
  const webhookHeader = 'toss-signature';

  beforeAll(async () => {
    process.env.TOSS_WEBHOOK_SECRET = webhookSecret;
    process.env.TOSS_WEBHOOK_SIGNATURE_HEADER = webhookHeader;
    process.env.TOSS_WEBHOOK_MAX_AGE_SECONDS = '300';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(undefined, {
      rawBody: true,
    } as NestApplicationOptions);

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

    process.env.TOSS_WEBHOOK_SECRET = originalWebhookSecret;
    process.env.TOSS_WEBHOOK_SIGNATURE_HEADER = originalWebhookHeader;
    process.env.TOSS_WEBHOOK_MAX_AGE_SECONDS = originalWebhookMaxAge;
  });

  describe('/payments/prepare (POST)', () => {
    it('should reject invalid payloads before touching payment flow', () => {
      return request(app.getHttpServer())
        .post('/payments/prepare')
        .send({})
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'orderId must be a string',
              'amount must not be less than 1',
              'amount must be a number conforming to the specified constraints',
              'paymentMethod must be one of the following values: CARD, VIRTUAL_ACCOUNT, TRANSFER, MOBILE',
            ]),
          );
        });
    });
  });

  describe('/payments/confirm (POST)', () => {
    it('should reject malformed confirmation requests', () => {
      return request(app.getHttpServer())
        .post('/payments/confirm')
        .send({
          orderId: 'test-order',
          amount: 0,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'paymentKey must be a string',
              'amount must not be less than 1',
            ]),
          );
        });
    });
  });

  describe('/payments/webhook/toss (POST)', () => {
    const makePayload = (createdAt: string) => ({
      eventType: 'PAYMENT_CONFIRMED',
      createdAt,
      data: {
        orderId: 'order-for-webhook',
        paymentKey: 'payment-key-for-webhook',
        status: 'DONE',
        amount: 15000,
      },
    });

    it('should reject webhook requests without a valid signature', () => {
      const payload = makePayload(new Date().toISOString());

      return request(app.getHttpServer())
        .post('/payments/webhook/toss')
        .send(payload)
        .expect(401)
        .expect((res) => {
          expect(res.body.error).toBe('WEBHOOK_SIGNATURE_VERIFICATION_FAILED');
        });
    });

    it('should reject malformed webhook payloads before processing', () => {
      const payload = {
        ...makePayload(new Date().toISOString()),
        createdAt: 'not-a-date',
      };

      return request(app.getHttpServer())
        .post('/payments/webhook/toss')
        .send(payload)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toEqual(
            expect.arrayContaining([
              'createdAt must be a valid ISO 8601 date string',
            ]),
          );
        });
    });
  });

  describe('/customer/payments/:paymentId/refund (POST)', () => {
    it('should require authentication for refunds', () => {
      return request(app.getHttpServer())
        .post('/customer/payments/test-payment/refund?branchId=test-branch')
        .send({ reason: 'customer requested refund' })
        .expect(401);
    });
  });
});
