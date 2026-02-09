# Notifications Module - Quick Start Guide

## What is this module?

The Notifications Module provides email and SMS notification capabilities for the OrderFriends application. It handles:

- Order confirmations
- Order status updates
- Payment confirmations
- Refund notifications
- Low stock alerts

## Quick Setup (2 minutes)

### 1. Environment Variables

The module is already configured to work in **mock mode** - no setup required for development!

Check your `.env` file:

```env
# These can be empty for mock mode (development)
SENDGRID_API_KEY=
SMS_API_KEY=
FROM_EMAIL=noreply@orderfriends.com
FROM_NAME=OrderFriends
```

**Mock Mode**: Notifications are logged to console instead of being sent. Perfect for development and testing!

### 2. Module is Already Registered

The NotificationsModule is already added to `app.module.ts` - nothing to do!

### 3. Start Using It

Import and inject in any service:

```typescript
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class YourService {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  async yourMethod() {
    // Send an email notification
    const result = await this.notificationsService.sendOrderConfirmation(
      orderId,
      {
        orderNo: 'ORD-123',
        orderedAt: new Date().toISOString(),
        customerName: '홍길동',
        items: [{ name: '상품A', qty: 2, unitPrice: 10000 }],
        subtotal: 20000,
        shippingFee: 3000,
        discount: 0,
        total: 23000,
      },
      'customer@example.com',
    );

    console.log('Sent:', result.success);
  }
}
```

## Testing It Out

### Option 1: Check Console Logs

When you send a notification in mock mode, you'll see beautiful formatted output in your console:

```
📧 [MOCK EMAIL] ================================
To: customer@example.com
From: OrderFriends <noreply@orderfriends.com>
Subject: 주문 확인 - 주문번호 ORD-123
HTML:
<!DOCTYPE html>
<html>
  ... (full HTML template) ...
</html>
==============================================
```

### Option 2: Run the Application

```bash
npm run start:dev
```

Then trigger an order status update via API:

```bash
curl -X PATCH http://localhost:3000/admin/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "CONFIRMED"}'
```

You'll see the notification logged in the console.

## Sending Different Notification Types

### Email Notifications

```typescript
// Order confirmation
await this.notificationsService.sendOrderConfirmation(orderId, orderData, email);

// Status update
await this.notificationsService.sendOrderStatusUpdate(orderId, statusData, email);

// Payment confirmation
await this.notificationsService.sendPaymentConfirmation(orderId, paymentData, email);

// Refund confirmation
await this.notificationsService.sendRefundConfirmation(orderId, refundData, email);

// Low stock alert
await this.notificationsService.sendLowStockAlert(productId, branchId, stockData, email);
```

### SMS Notifications

```typescript
// Order confirmation SMS
await this.notificationsService.sendOrderConfirmationSMS(orderId, smsData, phone);

// Order ready SMS
await this.notificationsService.sendOrderReadySMS(orderId, readyData, phone);

// Delivery complete SMS
await this.notificationsService.sendDeliveryCompleteSMS(orderId, deliveryData, phone);
```

## Going to Production

When ready for production:

### 1. Get SendGrid API Key

1. Sign up at https://sendgrid.com
2. Create an API key with "Mail Send" permissions
3. Add to `.env`:

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Get SMS API Key (Optional)

Choose a provider:
- **Twilio**: https://www.twilio.com
- **AWS SNS**: https://aws.amazon.com/sns/
- **국내**: COOL SMS, 알리고, etc.

Add to `.env`:

```env
SMS_API_KEY=your_sms_api_key_here
```

### 3. Update the Service

The service includes TODOs for actual API integration:

```typescript
// In notifications.service.ts, search for "TODO: Integrate with SendGrid API"
// and "TODO: Integrate with SMS API" to add actual implementations
```

## Common Use Cases

### Use Case 1: Send Notification When Order Status Changes

Already integrated! Just update order status and notification is sent automatically (see `orders.service.ts`).

### Use Case 2: Send Notification When Payment Succeeds

See `INTEGRATION_EXAMPLE.md` for payment integration example.

### Use Case 3: Send Low Stock Alert

```typescript
// In your inventory service
async checkInventory(branchId: string) {
  // ... check stock logic ...

  if (currentStock <= minimumStock) {
    await this.notificationsService.sendLowStockAlert(
      productId,
      branchId,
      {
        productName: 'Product A',
        branchName: 'Branch 1',
        currentStock: 5,
        minimumStock: 10,
        alertedAt: new Date().toISOString(),
      },
      'manager@example.com',
    );
  }
}
```

## File Structure

```
src/modules/notifications/
├── dto/
│   └── notification.dto.ts      # TypeScript interfaces and types
├── notifications.service.ts      # Main service with all notification methods
├── notifications.module.ts       # NestJS module configuration
├── index.ts                      # Barrel export
├── README.md                     # Full documentation
├── INTEGRATION_EXAMPLE.md        # Detailed integration examples
└── QUICKSTART.md                 # This file
```

## Need Help?

1. **Mock mode not working?** Check that API keys are empty in `.env`
2. **Want to customize templates?** Edit template methods in `notifications.service.ts`
3. **Integration questions?** See `INTEGRATION_EXAMPLE.md`
4. **Full documentation?** See `README.md`

## Next Steps

- [ ] Integrate into OrdersModule (example provided)
- [ ] Integrate into PaymentsModule
- [ ] Integrate into InventoryModule
- [ ] Customize email templates
- [ ] Add your SendGrid API key for production
- [ ] Set up SMS provider for production
- [ ] Implement notification queue for retry logic
- [ ] Add notification preferences per user

---

**That's it!** You're ready to send notifications. Start in mock mode, test everything, then add API keys for production.
