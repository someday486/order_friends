import { Injectable } from '@nestjs/common';
import { OrderStatus } from './order-status.enum';

@Injectable()
export class OrdersService {
  // TODO: supabase 연동 예정
  async getOrders() {
    return [
      {
        id: 'OF-1001',
        orderedAt: '2026-01-21 10:12',
        customerName: '김민지',
        totalAmount: 35000,
        status: OrderStatus.PAID,
      },
    ];
  }

  async getOrder(orderId: string) {
    return {
      id: orderId,
      orderedAt: '2026-01-21 10:12',
      status: OrderStatus.PAID,
      customer: {
        name: '김민지',
        phone: '010-1234-5678',
        address1: '서울시 강남구 테헤란로 123',
        address2: '101동 1004호',
        memo: '문 앞에 놓아주세요.',
      },
      payment: {
        method: 'CARD',
        subtotal: 32000,
        shippingFee: 3000,
        discount: 0,
        total: 35000,
      },
      items: [
        { id: 'I-1', name: '닭가슴살 10팩', option: '오리지널', qty: 1, unitPrice: 22000 },
        { id: 'I-2', name: '프로틴바', option: '초코', qty: 2, unitPrice: 5000 },
      ],
    };
  }

  async updateStatus(orderId: string, status: OrderStatus) {
    return {
      id: orderId,
      status,
    };
  }
}
