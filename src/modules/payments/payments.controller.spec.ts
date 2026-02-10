import { Test, TestingModule } from '@nestjs/testing';
import {
  PaymentsPublicController,
  PaymentsCustomerController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { CustomerGuard } from '../../common/guards/customer.guard';

describe('PaymentsController', () => {
  const mockService = {
    preparePayment: jest.fn(),
    confirmPayment: jest.fn(),
    getPaymentStatus: jest.fn(),
    handleTossWebhook: jest.fn(),
    getPayments: jest.fn(),
    getPaymentDetail: jest.fn(),
    refundPayment: jest.fn(),
  };
  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PaymentsPublicController', () => {
    let controller: PaymentsPublicController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentsPublicController],
        providers: [{ provide: PaymentsService, useValue: mockService }],
      }).compile();

      controller = module.get<PaymentsPublicController>(
        PaymentsPublicController,
      );
    });

    it('preparePayment should call service and return result', async () => {
      mockService.preparePayment.mockResolvedValue({ orderId: 'order-1' });

      const result = await controller.preparePayment({
        orderId: 'order-1',
      } as any);

      expect(result).toEqual({ orderId: 'order-1' });
      expect(mockService.preparePayment).toHaveBeenCalledWith({
        orderId: 'order-1',
      });
    });

    it('preparePayment should propagate service error', async () => {
      mockService.preparePayment.mockRejectedValue(new Error('boom'));

      await expect(controller.preparePayment({} as any)).rejects.toThrow(
        'boom',
      );
    });

    it('confirmPayment should call service and return result', async () => {
      mockService.confirmPayment.mockResolvedValue({ paymentKey: 'pk' });

      const result = await controller.confirmPayment({
        paymentKey: 'pk',
      } as any);

      expect(result).toEqual({ paymentKey: 'pk' });
      expect(mockService.confirmPayment).toHaveBeenCalledWith({
        paymentKey: 'pk',
      });
    });

    it('confirmPayment should propagate service error', async () => {
      mockService.confirmPayment.mockRejectedValue(new Error('boom'));

      await expect(controller.confirmPayment({} as any)).rejects.toThrow(
        'boom',
      );
    });

    it('getPaymentStatus should call service and return result', async () => {
      mockService.getPaymentStatus.mockResolvedValue({ status: 'DONE' });

      const result = await controller.getPaymentStatus('order-1');

      expect(result).toEqual({ status: 'DONE' });
      expect(mockService.getPaymentStatus).toHaveBeenCalledWith('order-1');
    });

    it('getPaymentStatus should propagate service error', async () => {
      mockService.getPaymentStatus.mockRejectedValue(new Error('boom'));

      await expect(controller.getPaymentStatus('order-1')).rejects.toThrow(
        'boom',
      );
    });

    it('handleTossWebhook should call service and return success', async () => {
      mockService.handleTossWebhook.mockResolvedValue(undefined);

      const rawBody = Buffer.from('raw-body');
      const result = await controller.handleTossWebhook(
        { eventType: 'PAYMENT' } as any,
        { 'x-signature': 'sig' },
        { rawBody } as any,
      );

      expect(result).toEqual({ success: true });
      expect(mockService.handleTossWebhook).toHaveBeenCalledWith(
        { eventType: 'PAYMENT' },
        { 'x-signature': 'sig' },
        rawBody,
      );
    });

    it('handleTossWebhook should propagate service error', async () => {
      mockService.handleTossWebhook.mockRejectedValue(new Error('boom'));

      await expect(
        controller.handleTossWebhook({} as any, {} as any, {} as any),
      ).rejects.toThrow('boom');
    });

    it('handleTossWebhook should pass undefined rawBody when missing', async () => {
      mockService.handleTossWebhook.mockResolvedValue(undefined);

      const result = await controller.handleTossWebhook(
        { eventType: 'PAYMENT' } as any,
        { 'x-signature': 'sig' },
        undefined as any,
      );

      expect(result).toEqual({ success: true });
      expect(mockService.handleTossWebhook).toHaveBeenCalledWith(
        { eventType: 'PAYMENT' },
        { 'x-signature': 'sig' },
        undefined,
      );
    });
  });

  describe('PaymentsCustomerController', () => {
    let controller: PaymentsCustomerController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [PaymentsCustomerController],
        providers: [
          { provide: PaymentsService, useValue: mockService },
          { provide: CustomerGuard, useValue: mockGuard },
        ],
      })
        .overrideGuard(CustomerGuard)
        .useValue(mockGuard)
        .compile();

      controller = module.get<PaymentsCustomerController>(
        PaymentsCustomerController,
      );
    });

    it('getPayments should call service and return result', async () => {
      mockService.getPayments.mockResolvedValue({ items: [] });

      const pagination = { page: 1, limit: 10 } as any;
      const result = await controller.getPayments('branch-1', pagination);

      expect(result).toEqual({ items: [] });
      expect(mockService.getPayments).toHaveBeenCalledWith(
        'branch-1',
        pagination,
      );
    });

    it('getPayments should propagate service error', async () => {
      mockService.getPayments.mockRejectedValue(new Error('boom'));

      await expect(
        controller.getPayments('branch-1', {} as any),
      ).rejects.toThrow('boom');
    });

    it('getPaymentDetail should call service and return result', async () => {
      mockService.getPaymentDetail.mockResolvedValue({ id: 'payment-1' });

      const result = await controller.getPaymentDetail('payment-1', 'branch-1');

      expect(result).toEqual({ id: 'payment-1' });
      expect(mockService.getPaymentDetail).toHaveBeenCalledWith(
        'payment-1',
        'branch-1',
      );
    });

    it('getPaymentDetail should propagate service error', async () => {
      mockService.getPaymentDetail.mockRejectedValue(new Error('boom'));

      await expect(
        controller.getPaymentDetail('payment-1', 'branch-1'),
      ).rejects.toThrow('boom');
    });

    it('refundPayment should call service and return result', async () => {
      mockService.refundPayment.mockResolvedValue({ status: 'REFUNDED' });

      const dto = { reason: 'test' } as any;
      const result = await controller.refundPayment(
        'payment-1',
        'branch-1',
        dto,
        { user: { id: 'user-1' } } as any,
      );

      expect(result).toEqual({ status: 'REFUNDED' });
      expect(mockService.refundPayment).toHaveBeenCalledWith(
        'payment-1',
        'branch-1',
        dto,
      );
    });

    it('refundPayment should propagate service error', async () => {
      mockService.refundPayment.mockRejectedValue(new Error('boom'));

      await expect(
        controller.refundPayment('payment-1', 'branch-1', {} as any, {} as any),
      ).rejects.toThrow('boom');
    });
  });
});
