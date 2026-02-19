# Notifications Module

This module provides email and SMS notification capabilities for the OrderFriends application.

## Features

- **Email Notifications** (via SendGrid - mock mode by default)
  - Order confirmation
  - Order status updates
  - Payment confirmation
  - Refund confirmation
  - Low stock alerts

- **SMS Notifications** (mock mode by default)
  - Order confirmation
  - Order ready for pickup
  - Delivery complete

## Configuration

Add the following environment variables to your `.env` file:

```env
# Notification settings (leave empty for mock mode)
SENDGRID_API_KEY=
SMS_API_KEY=
FROM_EMAIL=noreply@orderfriends.com
FROM_NAME=OrderFriends
KAKAO_TALK_API_URL=
KAKAO_TALK_ACCESS_TOKEN=
KAKAO_TALK_DEFAULT_TEMPLATE_CODE=
```

**Mock Mode**: If `SENDGRID_API_KEY` or `SMS_API_KEY` are not set, the service will run in mock mode and log notifications to the console instead of sending them.
If KakaoTalk credentials are not set, KakaoTalk notifications also run in mock mode.

### KakaoTalk Test API

`POST /customer/notifications/send-kakao`

Use this endpoint to send a test KakaoTalk message payload. It returns a `NotificationResult` and behaves as a real sender only when `KAKAO_TALK_API_URL` and `KAKAO_TALK_ACCESS_TOKEN` are configured.

## Usage

### Import the module

```typescript
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  // ...
})
export class YourModule {}
```

### Inject the service

```typescript
import { NotificationsService } from './modules/notifications/notifications.service';

@Injectable()
export class YourService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}
}
```

### Send notifications

#### Order Confirmation Email

```typescript
const orderData = {
  orderNo: 'ORD-123456',
  orderedAt: new Date().toISOString(),
  customerName: '홍길동',
  items: [
    {
      name: '제품A',
      option: '옵션1',
      qty: 2,
      unitPrice: 10000,
    },
  ],
  subtotal: 20000,
  shippingFee: 3000,
  discount: 0,
  total: 23000,
  deliveryAddress: '서울시 강남구...',
  deliveryMemo: '문 앞에 놓아주세요',
};

const result = await this.notificationsService.sendOrderConfirmation(
  orderId,
  orderData,
  'customer@example.com',
);

if (result.success) {
  console.log('Email sent successfully');
} else {
  console.error('Failed to send email:', result.errorMessage);
}
```

#### Order Status Update Email

```typescript
const statusData = {
  orderNo: 'ORD-123456',
  customerName: '홍길동',
  oldStatus: 'CONFIRMED',
  newStatus: 'SHIPPING',
  statusMessage: '주문하신 상품이 배송 중입니다.',
  updatedAt: new Date().toISOString(),
};

await this.notificationsService.sendOrderStatusUpdate(
  orderId,
  statusData,
  'customer@example.com',
);
```

#### Payment Confirmation Email

```typescript
const paymentData = {
  orderNo: 'ORD-123456',
  customerName: '홍길동',
  paymentMethod: '신용카드',
  amount: 23000,
  paidAt: new Date().toISOString(),
  transactionId: 'TXN-789012',
};

await this.notificationsService.sendPaymentConfirmation(
  orderId,
  paymentData,
  'customer@example.com',
);
```

#### SMS Notifications

```typescript
// Order confirmation SMS
const smsData = {
  orderNo: 'ORD-123456',
  customerName: '홍길동',
  total: 23000,
};

await this.notificationsService.sendOrderConfirmationSMS(
  orderId,
  smsData,
  '010-1234-5678',
);

// Order ready SMS
const readyData = {
  orderNo: 'ORD-123456',
  branchName: '강남점',
  branchPhone: '02-1234-5678',
};

await this.notificationsService.sendOrderReadySMS(
  orderId,
  readyData,
  '010-1234-5678',
);
```

#### Low Stock Alert

```typescript
const stockData = {
  productName: '제품A',
  productSku: 'SKU-123',
  branchName: '강남점',
  currentStock: 3,
  minimumStock: 10,
  alertedAt: new Date().toISOString(),
};

await this.notificationsService.sendLowStockAlert(
  productId,
  branchId,
  stockData,
  'manager@example.com',
);
```

## Integration Example

Here's how to integrate notifications into the OrdersService:

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async updateStatus(
    accessToken: string,
    orderId: string,
    status: OrderStatus,
    branchId: string,
  ) {
    // Update order status in database
    const updatedOrder = await this.updateOrderInDb(orderId, status, branchId);

    // Get order details for notification
    const orderDetail = await this.getOrder(accessToken, orderId, branchId);

    // Send status update notification
    if (orderDetail.customer?.email) {
      const statusData = {
        orderNo: orderDetail.orderNo || orderId,
        customerName: orderDetail.customer.name,
        oldStatus: updatedOrder.oldStatus,
        newStatus: status,
        statusMessage: this.getStatusMessage(status),
        updatedAt: new Date().toISOString(),
      };

      // Don't await - send async
      this.notificationsService
        .sendOrderStatusUpdate(orderId, statusData, orderDetail.customer.email)
        .catch((err) => this.logger.error('Failed to send status update email', err));
    }

    return updatedOrder;
  }

  private getStatusMessage(status: OrderStatus): string {
    const messages = {
      CONFIRMED: '주문이 확인되었습니다.',
      PREPARING: '상품을 준비 중입니다.',
      READY: '상품이 준비되었습니다.',
      SHIPPING: '배송 중입니다.',
      DELIVERED: '배송이 완료되었습니다.',
    };
    return messages[status] || '주문 상태가 변경되었습니다.';
  }
}
```

## TODO

- [ ] Integrate SendGrid API for actual email sending
- [ ] Integrate SMS API (Twilio, AWS SNS, etc.)
- [ ] Implement retry logic for failed notifications
- [ ] Add notification queue (Bull, BullMQ) for async processing
- [ ] Store notification logs in database
- [ ] Add notification preferences per user
- [ ] Support notification templates in database
- [ ] Add support for push notifications (Firebase, OneSignal)
- [ ] Implement notification rate limiting
- [ ] Add notification analytics and tracking

## API Reference

### NotificationsService Methods

#### Email Methods

- `sendOrderConfirmation(orderId, orderData, recipientEmail)` - Send order confirmation
- `sendOrderStatusUpdate(orderId, statusData, recipientEmail)` - Send status update
- `sendPaymentConfirmation(orderId, paymentData, recipientEmail)` - Send payment confirmation
- `sendRefundConfirmation(orderId, refundData, recipientEmail)` - Send refund confirmation
- `sendLowStockAlert(productId, branchId, stockData, recipientEmail)` - Send stock alert

#### SMS Methods

- `sendOrderConfirmationSMS(orderId, smsData, phone)` - Send order confirmation SMS
- `sendOrderReadySMS(orderId, readyData, phone)` - Send ready for pickup SMS
- `sendDeliveryCompleteSMS(orderId, deliveryData, phone)` - Send delivery complete SMS

### Return Type

All methods return `Promise<NotificationResult>`:

```typescript
interface NotificationResult {
  success: boolean;
  type: NotificationType; // 'EMAIL' | 'SMS' | 'PUSH'
  recipient: string;
  errorMessage?: string;
  retryCount?: number;
  sentAt?: string;
}
```

## License

MIT
