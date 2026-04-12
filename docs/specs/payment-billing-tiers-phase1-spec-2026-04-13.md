# Phase 1: PG 티어 주문 플로우

작성일: 2026-04-13
상태: Draft v1
상위 문서: `docs/specs/payment-billing-tiers-master-spec-2026-04-13.md`
선행 Phase: Phase 0

## 1. 문서 목적

이 문서는 PG 티어(토스페이먼츠 이용) 브랜드의 주문~결제 플로우 변경을 정의한다.

## 2. 포함 / 제외 범위

### 포함

- PG 브랜드 주문 시 결제수단 제한 (토스 위젯 전용)
- 주문 생성 시 tier 기반 paymentMethod 유효성 검증
- 공개 API 응답에서 tier 기반 결제 정보 분기
- 결제 성공 시 정산 line item 생성
- 프론트엔드 체크아웃 UI 분기

### 제외

- 정산 배치 계산 및 보고서 (Phase 3)
- Non-PG 티어 플로우 (Phase 2)
- 수수료 구간 자동 적용 로직 (Phase 3)

## 3. 현재 PG 플로우 (As-Is)

```
고객 → 주문 페이지 → CARD/TRANSFER 선택
  ├─ CARD → PreparePayment → 토스 위젯 → ConfirmPayment → 결제 완료
  └─ TRANSFER → 주문 생성 → 계좌정보 표시 → 수동 이체 → 입금 확인
```

1. `CreatePublicOrderRequest.paymentMethod`: `CARD` 또는 `TRANSFER`
2. CARD 선택 시 `PaymentsService.preparePayment()` → 토스 위젯 렌더
3. 토스 위젯 완료 → `/order/payment/success` → `confirmPayment()`
4. `payments` 레코드 생성 (`provider: TOSS`, `status: SUCCESS`)
5. DB 트리거 `update_order_payment_status()` → 주문 `payment_status: PAID`

## 4. 변경 후 PG 플로우 (To-Be)

```
고객 → 주문 페이지 → 토스 결제 (자동, 선택 없음)
  └─ PreparePayment → 토스 위젯 (카드/가상계좌/모바일 등) → ConfirmPayment → 결제 완료
                                                          └─ settlement_line_items 생성
```

- PG 브랜드: TRANSFER 옵션 완전 제거
- 고객은 결제수단을 "선택"하지 않음 → 토스 위젯이 하위 수단(카드, 가상계좌, 모바일 등) 제공
- `paymentMethod` 필드는 `'CARD'`로 고정 전송 (토스 위젯을 의미)

## 5. API 변경

### 5.1 GET /public/branches/:id 응답 변경

```typescript
// PublicBranchResponse에 billingTier 추가
interface PublicBranchResponse {
  // ... 기존 필드
  billingTier: 'PG' | 'NON_PG';          // 신규: 프론트엔드 체크아웃 분기용
  allowedPaymentMethods: string[];         // PG → ['CARD'], Non-PG → ['TRANSFER']
  transferAccount?: {                      // PG 티어에서는 null/undefined
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  } | null;
}
```

- PG 브랜드: `billingTier: 'PG'`, `allowedPaymentMethods: ['CARD']`, `transferAccount: null`
- Non-PG 브랜드: `billingTier: 'NON_PG'`, `allowedPaymentMethods: ['TRANSFER']`, `transferAccount: {...}`

### 5.2 GET /public/shop/:brandSlug 응답 변경

```typescript
// PublicShopBrandResponse에 billingTier 추가
interface PublicShopBrandResponse {
  // ... 기존 필드
  billingTier: 'PG' | 'NON_PG';
  paymentMethods: string[];                // PG → ['CARD'], Non-PG → ['TRANSFER']
  transferAccount?: {...} | null;          // PG에서는 null
}
```

### 5.3 POST /public/orders 유효성 검증

```typescript
// public-order.service.ts — createOrder 내 검증 추가
// 1. 주문 대상 브랜드의 billing_tier 조회
// 2. PG 브랜드 && paymentMethod === 'TRANSFER' → 400 Bad Request
// 3. Non-PG 브랜드 && paymentMethod === 'CARD' → 400 Bad Request
```

### 5.4 POST /public/shop/:brandSlug/orders 유효성 검증

동일 로직 적용.

## 6. 결제 성공 시 정산 line item 생성

`PaymentsService.confirmPayment()` 성공 후:

```typescript
// 1. 주문의 branch → brand 조회
// 2. brand.billing_tier === 'PG' 확인
// 3. brand.commission_rate 조회 (또는 commission_tiers에서 구간별 조회)
// 4. settlement_line_items INSERT:
//    - sale_amount: payment.amount
//    - commission_amount: Math.round(payment.amount * commission_rate)
//    - net_amount: sale_amount - commission_amount
// 5. 현재 settlement_period가 없으면 자동 생성 (PENDING 상태)
```

이 로직은 비동기로 처리하되, 실패 시 재시도 가능하도록 설계한다. 결제 확인 자체는 line item 생성 실패로 차단되지 않는다.

## 7. 환불 시 정산 처리

`PaymentsService.refundPayment()` 성공 후:

- 해당 payment의 settlement_line_item 조회
- 같은 정산 기간 내: line item의 금액 조정 또는 마이너스 line item 추가
- 다음 정산 기간: 현재 기간에 마이너스 line item 생성

## 8. 프론트엔드 변경

### 8.1 체크아웃 페이지 (Branch 직접 주문)

파일: `apps/web/src/app/order/branch/[branchId]/checkout/page.tsx`

```
if (branch.billingTier === 'PG') {
  // 결제수단 선택 UI 제거
  // 토스 위젯만 렌더
  // paymentMethod = 'CARD' 고정
} else {
  // TRANSFER만 표시
  // 토스 위젯 렌더하지 않음
  // 주문 완료 후 계좌정보 표시
}
```

### 8.2 체크아웃 페이지 (Shop 주문)

파일: `apps/web/src/app/order/[brandSlug]/[branchSlug]/checkout/page.tsx`

동일 분기 로직.

### 8.3 주문 추적 페이지

파일: `apps/web/src/app/order/track/[orderId]/page.tsx`

- PG 주문: 결제 완료 상태 표시 (토스 결제 정보)
- Non-PG 주문: 계좌 정보 + 이체 안내 표시 (기존과 동일)

## 9. 영향받는 파일 목록

| 파일 | 변경 내용 |
| --- | --- |
| `src/modules/public-order/public-order.service.ts` | tier 기반 paymentMethod 검증, 응답에 billingTier 추가 |
| `src/modules/public-order/dto/public-order.dto.ts` | PublicBranchResponse에 billingTier 추가 |
| `src/modules/public-order/dto/public-shop.dto.ts` | PublicShopBrandResponse에 billingTier 추가 |
| `src/modules/payments/payments.service.ts` | confirmPayment 후 settlement line item 생성 |
| `apps/web/src/app/order/branch/[branchId]/checkout/page.tsx` | tier 분기 체크아웃 UI |
| `apps/web/src/app/order/[brandSlug]/[branchSlug]/checkout/page.tsx` | tier 분기 체크아웃 UI |
| `apps/web/src/app/order/track/[orderId]/page.tsx` | tier 기반 결제 정보 표시 분기 |
| `apps/web/src/types/common.ts` | billingTier 타입 추가 |

## 10. 성공 / 실패 시나리오

### 성공 플로우

1. PG 브랜드 고객 → 체크아웃 진입 → 토스 위젯 표시 → 카드 결제 → 결제 완료 → settlement line item 생성
2. 주문 상태: CREATED → payment_status PAID → CONFIRMED (매장 확인)

### 실패 플로우

1. PG 브랜드에 `paymentMethod: 'TRANSFER'` 요청 → 400 Bad Request, "이 브랜드는 계좌이체를 지원하지 않습니다"
2. 토스 결제 실패 → 기존 실패 플로우 유지 (payment status: FAILED)
3. Settlement line item 생성 실패 → 결제는 성공 유지, 별도 재시도 큐/로그

## 11. 검증 체크리스트

- [ ] PG 브랜드 체크아웃에서 TRANSFER 옵션이 표시되지 않는지 확인
- [ ] PG 브랜드에 TRANSFER 결제 요청 시 400 응답 확인
- [ ] Non-PG 브랜드 체크아웃에서 토스 위젯이 표시되지 않는지 확인
- [ ] Non-PG 브랜드에 CARD 결제 요청 시 400 응답 확인
- [ ] PG 결제 성공 후 settlement_line_items 레코드 생성 확인
- [ ] 환불 시 settlement_line_items 조정 확인
- [ ] 기존 테스트 통과 확인
- [ ] 프론트엔드 체크아웃 양쪽 경로 수동 테스트
