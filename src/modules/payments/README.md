# Payments Module

Payment management backend module with Toss Payments integration.

## Overview

This module provides comprehensive payment processing capabilities including:
- Payment preparation and validation
- Payment confirmation with Toss Payments
- Payment status tracking
- Webhook handling for payment events
- Refund processing
- Payment history and reporting

## Features

### Public Endpoints (No Authentication Required)

#### 1. Prepare Payment
**POST** `/payments/prepare`

Validates order and returns payment information.

**Request:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "paymentMethod": "CARD"
}
```

**Response:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "orderNo": "ORD-20260206-001",
  "amount": 50000,
  "orderName": "커피 외 2건",
  "customerName": "홍길동",
  "customerPhone": "010-1234-5678"
}
```

**Validations:**
- Order exists and is not cancelled
- Order is not already paid
- Amount matches order total
- No successful payment record exists

#### 2. Confirm Payment
**POST** `/payments/confirm`

Confirms payment with Toss Payments and creates payment record.

**Request:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "paymentKey": "tgen_payment_key_123456",
  "amount": 50000
}
```

**Response:**
```json
{
  "paymentId": "payment-uuid",
  "orderId": "order-uuid",
  "status": "SUCCESS",
  "amount": 50000,
  "paidAt": "2026-02-06T10:30:00Z"
}
```

**Process:**
1. Validates order and amount
2. Calls Toss Payments confirm API (if configured)
3. Creates or updates payment record
4. Updates order status via database trigger

#### 3. Get Payment Status
**GET** `/payments/:orderId/status`

Retrieves payment status for an order.

**Response:**
```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "status": "SUCCESS",
  "amount": 50000,
  "paidAt": "2026-02-06T10:30:00Z"
}
```

#### 4. Toss Payments Webhook
**POST** `/payments/webhook/toss`

Handles webhook events from Toss Payments.

**Request:**
```json
{
  "eventType": "PAYMENT_CONFIRMED",
  "createdAt": "2026-02-06T10:30:00+09:00",
  "data": {
    "orderId": "order-uuid",
    "paymentKey": "tgen_payment_key_123456",
    "status": "DONE",
    "amount": 50000
  }
}
```

**Supported Events:**
- `PAYMENT_CONFIRMED` - Payment successfully confirmed
- `PAYMENT_CANCELLED` - Payment cancelled

**Process:**
1. Logs webhook event to `payment_webhook_logs`
2. Processes event based on type
3. Updates payment and order status
4. Marks webhook as processed

### Customer Endpoints (Authentication Required)

#### 1. List Payments
**GET** `/customer/payments?branchId=xxx&page=1&limit=20`

Lists payments for a branch with pagination.

**Response:**
```json
{
  "data": [
    {
      "id": "payment-uuid",
      "orderId": "order-uuid",
      "orderNo": "ORD-20260206-001",
      "amount": 50000,
      "status": "SUCCESS",
      "provider": "TOSS",
      "paymentMethod": "CARD",
      "paidAt": "2026-02-06T10:30:00Z",
      "createdAt": "2026-02-06T10:25:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### 2. Get Payment Detail
**GET** `/customer/payments/:paymentId?branchId=xxx`

Retrieves detailed payment information.

**Response:**
```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "orderNo": "ORD-20260206-001",
  "amount": 50000,
  "currency": "KRW",
  "provider": "TOSS",
  "status": "SUCCESS",
  "paymentMethod": "CARD",
  "paymentMethodDetail": {...},
  "providerPaymentId": "tgen_20260206_123456",
  "providerPaymentKey": "tgen_payment_key_123456",
  "paidAt": "2026-02-06T10:30:00Z",
  "refundAmount": 0,
  "metadata": {...},
  "createdAt": "2026-02-06T10:25:00Z",
  "updatedAt": "2026-02-06T10:30:00Z"
}
```

#### 3. Refund Payment
**POST** `/customer/payments/:paymentId/refund?branchId=xxx`

Processes payment refund (OWNER/ADMIN only).

**Request:**
```json
{
  "reason": "고객 요청에 의한 환불",
  "amount": 25000  // Optional - defaults to full refund
}
```

**Response:**
```json
{
  "paymentId": "payment-uuid",
  "status": "PARTIAL_REFUNDED",
  "refundAmount": 25000,
  "refundedAt": "2026-02-06T11:00:00Z"
}
```

**Validations:**
- Payment status is SUCCESS or PARTIAL_REFUNDED
- Refund amount does not exceed available amount
- User has ORDER_UPDATE_STATUS permission

## Payment States

### Payment Status
- `PENDING` - Payment preparation in progress
- `SUCCESS` - Payment successfully completed
- `FAILED` - Payment failed
- `CANCELLED` - Payment cancelled
- `REFUNDED` - Full refund completed
- `PARTIAL_REFUNDED` - Partial refund completed

### Payment Providers
- `TOSS` - Toss Payments (primary)
- `STRIPE` - Stripe (future)
- `MANUAL` - Manual payment entry

### Payment Methods
- `CARD` - Credit/Debit card
- `VIRTUAL_ACCOUNT` - Virtual account transfer
- `TRANSFER` - Bank transfer
- `MOBILE` - Mobile payment

## Database Schema

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  provider VARCHAR(50) NOT NULL,
  provider_payment_id VARCHAR(255),
  provider_payment_key VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(50),
  payment_method_detail TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  cancellation_reason TEXT,
  refund_amount INTEGER DEFAULT 0,
  refund_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id)
);
```

### payment_webhook_logs
```sql
CREATE TABLE payment_webhook_logs (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  request_body JSONB,
  request_headers JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Automatic Order Updates

The module uses database triggers to automatically update order status:

- `SUCCESS` → Sets order payment_status to 'PAID' and status to 'PENDING'
- `FAILED` → Sets order payment_status to 'FAILED'
- `CANCELLED` → Sets order payment_status and status to 'CANCELLED'
- `REFUNDED` → Sets order payment_status to 'REFUNDED' and status to 'CANCELLED'

## Toss Payments Integration

### Configuration

Set environment variables:
```bash
TOSS_SECRET_KEY=test_sk_xxxxxxxxxxxxxxxxxxxx
TOSS_CLIENT_KEY=test_ck_xxxxxxxxxxxxxxxxxxxx
```

### Mock Mode

If `TOSS_SECRET_KEY` is not configured, the module runs in mock mode:
- Payment confirmations succeed immediately
- Mock payment IDs are generated
- No actual API calls are made

### Production Integration

To enable actual Toss Payments API calls, implement:

1. **Confirm Payment API**
   ```typescript
   private async callTossPaymentsConfirmApi(
     paymentKey: string,
     orderId: string,
     amount: number
   ) {
     const response = await axios.post(
       `${this.tossApiBaseUrl}/payments/confirm`,
       { paymentKey, orderId, amount },
       {
         headers: {
           Authorization: `Basic ${Buffer.from(this.tossSecretKey + ':').toString('base64')}`,
           'Content-Type': 'application/json',
         },
       },
     );
     return response.data;
   }
   ```

2. **Refund API**
   ```typescript
   private async callTossPaymentsRefundApi(
     paymentKey: string,
     amount: number,
     reason: string
   ) {
     const response = await axios.post(
       `${this.tossApiBaseUrl}/payments/${paymentKey}/cancel`,
       { cancelReason: reason, cancelAmount: amount },
       {
         headers: {
           Authorization: `Basic ${Buffer.from(this.tossSecretKey + ':').toString('base64')}`,
           'Content-Type': 'application/json',
         },
       },
     );
     return response.data;
   }
   ```

3. **Webhook Signature Verification**
   ```typescript
   private verifyTossWebhookSignature(
     webhookData: any,
     headers: any
   ): boolean {
     // Implement signature verification based on Toss Payments docs
     return true;
   }
   ```

## Security Features

1. **Amount Validation**
   - Frontend and backend amounts must match
   - Prevents tampering with payment amounts

2. **Order Validation**
   - Order must exist and not be cancelled
   - Order must not already be paid
   - Order must belong to correct branch

3. **Branch Access Control**
   - Customer endpoints verify branch membership
   - Prevents cross-branch data access

4. **Refund Authorization**
   - Only OWNER/ADMIN roles can refund
   - Enforced via permission guard

5. **Webhook Logging**
   - All webhook events are logged
   - Enables debugging and audit trails

## Error Handling

### Payment Exceptions

- `PaymentNotFoundException` - Payment not found
- `PaymentAmountMismatchException` - Amount doesn't match
- `OrderAlreadyPaidException` - Order is already paid
- `PaymentNotAllowedException` - Payment not allowed
- `PaymentProviderException` - Provider API error
- `RefundNotAllowedException` - Refund not allowed
- `RefundAmountExceededException` - Refund exceeds available
- `WebhookSignatureVerificationException` - Invalid webhook signature

### HTTP Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Permission denied
- `404 Not Found` - Resource not found
- `409 Conflict` - Already paid
- `502 Bad Gateway` - Payment provider error

## Testing

### Manual Testing

1. **Prepare Payment:**
   ```bash
   curl -X POST http://localhost:3000/payments/prepare \
     -H "Content-Type: application/json" \
     -d '{
       "orderId": "order-uuid",
       "amount": 50000,
       "paymentMethod": "CARD"
     }'
   ```

2. **Confirm Payment:**
   ```bash
   curl -X POST http://localhost:3000/payments/confirm \
     -H "Content-Type: application/json" \
     -d '{
       "orderId": "order-uuid",
       "paymentKey": "test_payment_key",
       "amount": 50000
     }'
   ```

3. **Get Payment Status:**
   ```bash
   curl http://localhost:3000/payments/order-uuid/status
   ```

### Integration Testing

Create test cases for:
- Payment preparation with valid/invalid orders
- Payment confirmation success/failure
- Webhook event processing
- Refund processing
- Amount validation
- Order status updates

## Monitoring

Monitor these metrics:
- Payment success rate
- Payment failure reasons
- Webhook processing delays
- Refund processing time
- Payment provider response times

Query webhook logs:
```sql
SELECT
  event_type,
  processed,
  error_message,
  received_at
FROM payment_webhook_logs
WHERE processed = false
ORDER BY received_at DESC;
```

## Future Enhancements

- [ ] Implement Stripe integration
- [ ] Add payment retry mechanism
- [ ] Support partial payments
- [ ] Add payment scheduling
- [ ] Implement automatic refunds
- [ ] Add payment analytics dashboard
- [ ] Support multiple payment methods per order
- [ ] Add payment plan/subscription support

## References

- [Toss Payments API Documentation](https://docs.tosspayments.com/)
- [Toss Payments Webhook Guide](https://docs.tosspayments.com/guides/webhook)
- [Payment Security Best Practices](https://docs.tosspayments.com/guides/security)
