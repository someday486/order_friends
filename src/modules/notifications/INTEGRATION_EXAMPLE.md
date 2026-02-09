# Notification System Integration Examples

This guide shows how to integrate the NotificationService into existing modules.

## 1. Orders Module Integration

### Step 1: Import NotificationsModule

Edit `src/modules/orders/orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

### Step 2: Inject NotificationsService

Edit `src/modules/orders/orders.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus } from './order-status.enum';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ... existing methods ...

  async updateStatus(
    accessToken: string,
    orderId: string,
    status: OrderStatus,
    branchId: string,
  ) {
    this.logger.log(`Updating order status: ${orderId} to ${status}`);
    const sb = this.supabase.adminClient();

    const resolvedId = await this.resolveOrderId(sb, orderId, branchId);
    if (!resolvedId) {
      throw new OrderNotFoundException(orderId);
    }

    // Get current order for old status
    const { data: currentOrder } = await sb
      .from('orders')
      .select('status, customer_name, customer_email, order_no')
      .eq('id', resolvedId)
      .single();

    // Update status
    const { data, error } = await sb
      .from('orders')
      .update({ status })
      .eq('id', resolvedId)
      .eq('branch_id', branchId)
      .select('id, order_no, status')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to update order status: ${error.message}`, error);
      throw new BusinessException(
        'Failed to update order status',
        'ORDER_UPDATE_FAILED',
        500,
        { orderId, status, error: error.message },
      );
    }

    if (!data) {
      throw new OrderNotFoundException(orderId);
    }

    // Send status update notification (async, don't block)
    if (currentOrder?.customer_email) {
      const statusData = {
        orderNo: data.order_no || orderId,
        customerName: currentOrder.customer_name || '고객',
        oldStatus: currentOrder.status,
        newStatus: status,
        statusMessage: this.getStatusMessage(status),
        updatedAt: new Date().toISOString(),
      };

      this.notificationsService
        .sendOrderStatusUpdate(resolvedId, statusData, currentOrder.customer_email)
        .catch((err) => {
          this.logger.error('Failed to send status update notification', err);
        });
    }

    this.logger.log(`Order status updated successfully: ${orderId} -> ${status}`);

    return {
      id: data.id,
      orderNo: data.order_no ?? null,
      status: data.status as OrderStatus,
    };
  }

  private getStatusMessage(status: OrderStatus): string {
    const messages: Record<OrderStatus, string> = {
      PENDING: '주문 접수 대기 중입니다.',
      CONFIRMED: '주문이 확인되었습니다.',
      PREPARING: '상품을 준비 중입니다.',
      READY: '상품이 준비되었습니다. 픽업 가능합니다.',
      SHIPPING: '배송 중입니다.',
      DELIVERED: '배송이 완료되었습니다.',
      CANCELLED: '주문이 취소되었습니다.',
      REFUNDED: '환불이 완료되었습니다.',
    };
    return messages[status] || '주문 상태가 변경되었습니다.';
  }
}
```

## 2. Payments Module Integration

### Step 1: Import NotificationsModule

Edit `src/modules/payments/payments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

### Step 2: Send Payment Confirmation

Edit `src/modules/payments/payments.service.ts`:

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async processPayment(orderId: string, paymentData: any) {
    // ... process payment logic ...

    // On successful payment
    if (paymentData.status === 'SUCCESS') {
      // Get order details
      const { data: order } = await this.supabase
        .adminClient()
        .from('orders')
        .select('order_no, customer_name, customer_email, total_amount')
        .eq('id', orderId)
        .single();

      if (order?.customer_email) {
        const confirmationData = {
          orderNo: order.order_no,
          customerName: order.customer_name,
          paymentMethod: paymentData.method,
          amount: order.total_amount,
          paidAt: new Date().toISOString(),
          transactionId: paymentData.transactionId,
        };

        this.notificationsService
          .sendPaymentConfirmation(orderId, confirmationData, order.customer_email)
          .catch((err) => this.logger.error('Failed to send payment confirmation', err));
      }
    }

    return paymentResult;
  }
}
```

## 3. Inventory Module Integration (Low Stock Alerts)

### Step 1: Import NotificationsModule

Edit `src/modules/inventory/inventory.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
```

### Step 2: Send Low Stock Alerts

Edit `src/modules/inventory/inventory.service.ts`:

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkLowStockAndAlert(branchId: string) {
    const sb = this.supabase.adminClient();

    // Get low stock items
    const { data: lowStockItems } = await sb
      .from('inventory')
      .select(`
        id,
        qty_available,
        low_stock_threshold,
        product:products (
          id,
          name,
          sku
        ),
        branch:branches (
          id,
          name,
          manager_email
        )
      `)
      .eq('branch_id', branchId)
      .filter('qty_available', 'lte', 'low_stock_threshold');

    // Send alerts for each low stock item
    for (const item of lowStockItems || []) {
      if (item.branch?.manager_email && item.product) {
        const alertData = {
          productName: item.product.name,
          productSku: item.product.sku,
          branchName: item.branch.name,
          currentStock: item.qty_available,
          minimumStock: item.low_stock_threshold,
          alertedAt: new Date().toISOString(),
        };

        this.notificationsService
          .sendLowStockAlert(
            item.product.id,
            branchId,
            alertData,
            item.branch.manager_email,
          )
          .catch((err) => this.logger.error('Failed to send low stock alert', err));
      }
    }

    return { alertsSent: lowStockItems?.length || 0 };
  }
}
```

## 4. Public Order Module Integration (Customer Orders)

### Step 1: Import NotificationsModule

Edit `src/modules/public-order/public-order.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PublicOrderController } from './public-order.controller';
import { PublicOrderService } from './public-order.service';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [PublicOrderController],
  providers: [PublicOrderService],
  exports: [PublicOrderService],
})
export class PublicOrderModule {}
```

### Step 2: Send Order Confirmation

Edit `src/modules/public-order/public-order.service.ts`:

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PublicOrderService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createOrder(orderData: CreateOrderDto) {
    const sb = this.supabase.client();

    // Create order in database
    const { data: order, error } = await sb
      .from('orders')
      .insert({
        branch_id: orderData.branchId,
        customer_name: orderData.customerName,
        customer_phone: orderData.customerPhone,
        customer_email: orderData.customerEmail,
        delivery_address: orderData.deliveryAddress,
        delivery_memo: orderData.deliveryMemo,
        subtotal: orderData.subtotal,
        delivery_fee: orderData.deliveryFee,
        discount_total: orderData.discount,
        total_amount: orderData.total,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error || !order) {
      throw new Error('Failed to create order');
    }

    // Insert order items
    // ... (insert order items logic) ...

    // Send confirmation email
    if (orderData.customerEmail) {
      const confirmationData = {
        orderNo: order.order_no,
        orderedAt: order.created_at,
        customerName: orderData.customerName,
        items: orderData.items,
        subtotal: orderData.subtotal,
        shippingFee: orderData.deliveryFee,
        discount: orderData.discount,
        total: orderData.total,
        deliveryAddress: orderData.deliveryAddress,
        deliveryMemo: orderData.deliveryMemo,
      };

      this.notificationsService
        .sendOrderConfirmation(order.id, confirmationData, orderData.customerEmail)
        .catch((err) => this.logger.error('Failed to send order confirmation', err));
    }

    // Send confirmation SMS
    if (orderData.customerPhone) {
      const smsData = {
        orderNo: order.order_no,
        customerName: orderData.customerName,
        total: orderData.total,
      };

      this.notificationsService
        .sendOrderConfirmationSMS(order.id, smsData, orderData.customerPhone)
        .catch((err) => this.logger.error('Failed to send order confirmation SMS', err));
    }

    return order;
  }
}
```

## Best Practices

### 1. Always Use Async/Non-Blocking

Don't block the main request flow waiting for notifications:

```typescript
// ❌ Bad - blocks request
await this.notificationsService.sendEmail(...);

// ✅ Good - fire and forget with error handling
this.notificationsService
  .sendEmail(...)
  .catch(err => this.logger.error('Email failed', err));
```

### 2. Add Retry Logic for Critical Notifications

For important notifications (payment confirmations, etc.), consider implementing a queue:

```typescript
// TODO: Use Bull Queue for retry logic
await this.notificationQueue.add('send-payment-confirmation', {
  orderId,
  email,
  data: paymentData,
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

### 3. Log All Notification Attempts

Always log notification attempts for debugging:

```typescript
this.notificationsService
  .sendOrderConfirmation(orderId, data, email)
  .then(result => {
    if (result.success) {
      this.logger.log(`Order confirmation sent to ${email}`);
    } else {
      this.logger.error(`Failed to send confirmation: ${result.errorMessage}`);
    }
  })
  .catch(err => this.logger.error('Notification error', err));
```

### 4. Handle Missing Email/Phone Gracefully

Always check if contact information exists before sending:

```typescript
if (order?.customer_email) {
  await this.notificationsService.sendEmail(...);
} else {
  this.logger.warn(`No email for order ${orderId}, skipping notification`);
}
```

### 5. Use Template Helper Methods

Create helper methods in your service to build notification data:

```typescript
private buildOrderConfirmationData(order: Order) {
  return {
    orderNo: order.order_no,
    orderedAt: order.created_at,
    customerName: order.customer_name,
    items: order.items.map(item => ({
      name: item.product_name_snapshot,
      qty: item.qty,
      unitPrice: item.unit_price_snapshot,
    })),
    subtotal: order.subtotal,
    shippingFee: order.delivery_fee,
    discount: order.discount_total,
    total: order.total_amount,
  };
}
```

## Testing in Mock Mode

By default, the notification service runs in mock mode (when API keys are not configured). This allows you to:

1. See all notification content in console logs
2. Test integration without external API calls
3. Develop and debug email/SMS templates locally

To enable mock mode, simply leave the environment variables empty:

```env
SENDGRID_API_KEY=
SMS_API_KEY=
```

When ready for production, add your API keys:

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
SMS_API_KEY=your_sms_api_key_here
```

## Next Steps

1. Add notification preferences table to database
2. Implement notification queue with Bull/BullMQ
3. Add retry logic for failed notifications
4. Store notification logs in database
5. Add notification analytics dashboard
6. Implement user opt-out functionality
7. Add A/B testing for email templates
