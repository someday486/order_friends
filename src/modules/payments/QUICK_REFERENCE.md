# Payment Module - Quick Reference

## Public Endpoints (No Auth)

### 1. Prepare Payment
```http
POST /payments/prepare
Content-Type: application/json

{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "paymentMethod": "CARD"
}
```

### 2. Confirm Payment
```http
POST /payments/confirm
Content-Type: application/json

{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "paymentKey": "tgen_payment_key_123456",
  "amount": 50000
}
```

### 3. Get Payment Status
```http
GET /payments/:orderId/status
```

### 4. Webhook Handler
```http
POST /payments/webhook/toss
Content-Type: application/json

{
  "eventType": "PAYMENT_CONFIRMED",
  "createdAt": "2026-02-06T10:30:00+09:00",
  "data": {
    "orderId": "...",
    "paymentKey": "...",
    "status": "DONE",
    "amount": 50000
  }
}
```

## Customer Endpoints (Auth Required)

### 5. List Payments
```http
GET /customer/payments?branchId=xxx&page=1&limit=20
Authorization: Bearer {token}
```

### 6. Get Payment Detail
```http
GET /customer/payments/:paymentId?branchId=xxx
Authorization: Bearer {token}
```

### 7. Refund Payment (OWNER/ADMIN)
```http
POST /customer/payments/:paymentId/refund?branchId=xxx
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "고객 요청",
  "amount": 25000  // Optional
}
```

## Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (auth required)
- `403` - Forbidden (permission denied)
- `404` - Not Found
- `409` - Conflict (already paid)
- `502` - Bad Gateway (provider error)

## Payment States

- `PENDING` - In progress
- `SUCCESS` - Completed
- `FAILED` - Failed
- `CANCELLED` - Cancelled
- `REFUNDED` - Full refund
- `PARTIAL_REFUNDED` - Partial refund

## Environment Setup

```bash
TOSS_SECRET_KEY=test_sk_xxxxxxxxxxxxxxxxxxxx
TOSS_CLIENT_KEY=test_ck_xxxxxxxxxxxxxxxxxxxx
```

## Common Errors

| Error Code | Message | Solution |
|------------|---------|----------|
| `ORDER_NOT_FOUND` | Order not found | Check orderId is valid |
| `ORDER_ALREADY_PAID` | Already paid | Order can only be paid once |
| `PAYMENT_AMOUNT_MISMATCH` | Amount mismatch | Frontend/backend amounts must match |
| `REFUND_NOT_ALLOWED` | Refund not allowed | Payment must be SUCCESS status |
| `PAYMENT_PROVIDER_ERROR` | Provider error | Check Toss API credentials |

## Frontend Integration Example

```typescript
// 1. Prepare payment
const prepareRes = await fetch('/payments/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,
    amount: order.totalAmount,
    paymentMethod: 'CARD'
  })
});
const { orderId, amount, orderName, customerName } = await prepareRes.json();

// 2. Show Toss Payments widget
const tossPayments = TossPayments(clientKey);
const payment = tossPayments.payment({ customerKey });

await payment.requestPayment({
  method: 'CARD',
  amount: { currency: 'KRW', value: amount },
  orderId,
  orderName,
  successUrl: window.location.origin + '/payments/success',
  failUrl: window.location.origin + '/payments/fail',
  customerName,
});

// 3. On success page
const urlParams = new URLSearchParams(window.location.search);
const paymentKey = urlParams.get('paymentKey');
const orderId = urlParams.get('orderId');
const amount = urlParams.get('amount');

const confirmRes = await fetch('/payments/confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ orderId, paymentKey, amount })
});

if (confirmRes.ok) {
  alert('결제 성공!');
} else {
  alert('결제 확인 실패');
}
```

## Testing with cURL

```bash
# Prepare
curl -X POST http://localhost:3000/payments/prepare \
  -H "Content-Type: application/json" \
  -d '{"orderId":"xxx","amount":50000,"paymentMethod":"CARD"}'

# Confirm
curl -X POST http://localhost:3000/payments/confirm \
  -H "Content-Type: application/json" \
  -d '{"orderId":"xxx","paymentKey":"test_key","amount":50000}'

# Status
curl http://localhost:3000/payments/xxx/status

# List (auth)
curl http://localhost:3000/customer/payments?branchId=xxx \
  -H "Authorization: Bearer TOKEN"

# Refund (auth)
curl -X POST http://localhost:3000/customer/payments/xxx/refund?branchId=xxx \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"고객 요청","amount":50000}'
```

## Database Queries

```sql
-- Check payment
SELECT * FROM payments WHERE order_id = 'xxx';

-- Check webhooks
SELECT * FROM payment_webhook_logs
WHERE payment_id = 'xxx'
ORDER BY received_at DESC;

-- Payment stats
SELECT status, COUNT(*), SUM(amount)
FROM payments
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status;
```
