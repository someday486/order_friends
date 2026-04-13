# 결제 이원화 - 코덱스 추가 작업 지시서

작성일: 2026-04-13
대상: Codex (코드 구현 에이전트)
상위 스펙 문서:

- `docs/specs/payment-billing-tiers-master-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase0-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase1-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase2-spec-2026-04-13.md`
- `docs/specs/payment-billing-tiers-phase3-spec-2026-04-13.md`

## 배경

이전 코덱스 작업으로 Phase 0~3의 기본 구현이 완료되었다. 이번 작업은 **Non-PG 요금제 체계 도입**에 따른 추가 구현이다. 아래 작업은 스펙 문서 업데이트 내용과 기존 구현 간의 갭을 메우는 것이다.

### 핵심 결정: 기존 브랜드 마이그레이션

- **기존 브랜드는 전부 PG로 배정한다** (TRANSFER만 사용하던 브랜드 포함)
- Non-PG 티어는 **신규 가입자부터만** 적용
- 이유: 기존 Non-PG 브랜드에 빌링키/구독이 없으므로 서비스 이용 차단 위험 방지

## 작업 규칙

- `CLAUDE.md` 규칙을 따른다
- 기존 파일을 수정하는 것을 우선한다 (불필요한 신규 파일 생성 금지)
- 모든 작업 완료 후 `npm run lint`, `npm run test`, `npm run build` 통과 확인
- 결제 관련 변경이므로 영향 범위를 최소화한다

---

## 작업 0: 기존 마이그레이션 수정 — 기존 브랜드 전부 PG 배정

### 파일

- `supabase/migrations/20260413114500_add_payment_billing_phase0_schema.sql`

### 내용

기존 마이그레이션의 티어 배정 로직을 수정한다:

**변경 전:**
```sql
UPDATE public.brands
SET billing_tier = CASE
  WHEN 'CARD' = ANY(shop_payment_methods) THEN 'PG'
  ELSE 'NON_PG'
END,
    billing_tier_decided_at = NOW();
```

**변경 후:**
```sql
-- 기존 브랜드 전부 PG 배정 (Non-PG는 신규 가입자부터만 적용)
UPDATE public.brands
SET billing_tier = 'PG',
    billing_tier_decided_at = NOW();
```

또한 `branches.allowed_payment_methods` 정합성 부분도 수정:

**변경 후:**
```sql
-- 기존 브랜드 전부 PG이므로: 모든 매장 CARD만
UPDATE public.branches
SET allowed_payment_methods = ARRAY['CARD']::TEXT[];
```

Non-PG 매장 관련 UPDATE는 제거한다.

### 검증

- 마이그레이션 실행 후 모든 기존 브랜드가 `billing_tier = 'PG'`인지 확인
- 모든 기존 매장의 `allowed_payment_methods = ['CARD']`인지 확인
- `commission_rate`가 모든 브랜드에 설정되었는지 확인

---

## 작업 1: DB 마이그레이션 — subscription_plans에 max_monthly_orders 추가

### 파일

- `supabase/migrations/` 에 신규 마이그레이션 파일 생성 (타임스탬프 형식)

### 내용

```sql
-- subscription_plans 테이블에 주문 한도 컬럼 추가
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS max_monthly_orders INTEGER;

COMMENT ON COLUMN subscription_plans.max_monthly_orders IS '월 주문 한도 (NULL = 무제한)';

-- 시드 데이터 업데이트 (이미 INSERT된 데이터에 값 설정)
UPDATE subscription_plans SET max_monthly_orders = 100 WHERE name = 'Starter';
UPDATE subscription_plans SET max_monthly_orders = 500 WHERE name = 'Growth';
UPDATE subscription_plans SET max_monthly_orders = NULL WHERE name = 'Pro';
```

### 검증

- `subscription_plans` 테이블에 `max_monthly_orders` 컬럼 존재 확인
- Starter=100, Growth=500, Pro=NULL 확인

---

## 작업 2: PlanRow 타입에 max_monthly_orders 추가

### 파일

- `src/modules/billing/billing.service.ts`

### 내용

기존 `PlanRow` 타입에 `max_monthly_orders` 추가:

```typescript
type PlanRow = {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  max_monthly_orders: number | null; // 추가
};
```

---

## 작업 3: TRIAL 구독 생성 로직

### 파일

- `src/modules/billing/billing.service.ts`

### 내용

`issueBillingKey()` 메서드에서 빌링키 발급 성공 후 구독을 생성할 때:

1. `status: 'TRIAL'` 로 생성
2. `current_period_start: NOW()`
3. `current_period_end: NOW() + 14일`
4. `next_billing_at: NOW() + 14일`
5. `plan_id`: Starter 플랜의 ID 조회하여 설정

**기존에 ACTIVE로 생성하는 코드가 있다면 TRIAL로 변경한다.**

### 검증

- Non-PG 브랜드 빌링키 발급 후 `brand_subscriptions.status = 'TRIAL'` 확인
- `next_billing_at`이 14일 후인지 확인

---

## 작업 4: TRIAL → ACTIVE 전환 로직

### 파일

- `src/modules/billing/billing.service.ts`

### 내용

`processDueSubscriptions()` 메서드에서 기존 `ACTIVE`, `PAST_DUE` 외에 `TRIAL` 상태도 처리하도록 수정:

```typescript
// 기존: status IN ('ACTIVE', 'PAST_DUE')
// 변경: status IN ('ACTIVE', 'PAST_DUE', 'TRIAL')
```

TRIAL 구독의 `next_billing_at <= NOW()` 시:
1. 토스 빌링 API로 첫 결제 실행 (Starter 플랜 금액)
2. 성공 시: `status = 'ACTIVE'`, 기간 갱신
3. 실패 시: 기존 재시도 정책 적용

### 검증

- TRIAL 상태 구독이 14일 후 배치 잡에서 처리되는지 확인
- 결제 성공 시 ACTIVE 전환 확인
- 결제 실패 시 재시도 스케줄 적용 확인

---

## 작업 5: 체험 기간 중 해지 처리

### 파일

- `src/modules/billing/billing.service.ts`

### 내용

`cancelSubscription()` 메서드에서 TRIAL 상태 처리 추가:

- TRIAL 상태에서 해지 요청 시: 즉시 `CANCELLED` 처리 (결제 없음)
- `cancelled_at = NOW()`
- billing_records 생성하지 않음

### 검증

- TRIAL 상태에서 해지 시 즉시 CANCELLED 확인
- 빌링 레코드가 생성되지 않는지 확인

---

## 작업 6: 브랜드 생성 후 빌링키 등록 강제 리다이렉트

### 파일

- `apps/web/src/app/customer/brands/page.tsx`

### 내용

브랜드 생성 성공 콜백에서:

```typescript
// Non-PG 브랜드 생성 후
if (billingTier === 'NON_PG') {
  // /business/billing/setup 페이지로 리다이렉트
  router.push(`/business/billing/setup?brandId=${newBrandId}`);
} else {
  // 기존 PG 플로우 (매장 생성 등)
  router.push(`/customer/brands/${newBrandId}`);
}
```

### 검증

- Non-PG 브랜드 생성 후 `/business/billing/setup`으로 이동하는지 확인
- PG 브랜드 생성 후 기존 경로로 이동하는지 확인

---

## 작업 7: 빌링키 등록 페이지 (신규)

### 파일

- `apps/web/src/app/(protected)/business/billing/setup/page.tsx` (신규 생성)

### 내용

Non-PG 브랜드 생성 직후 진입하는 빌링키 등록 전용 페이지:

1. **UI 구성**:
   - 페이지 제목: "결제 수단 등록"
   - 안내 문구: "14일 무료 체험 후 월 ₩33,000부터 자동 결제됩니다"
   - 토스 빌링 위젯 렌더 (카드 등록용)
   - 등록 완료 버튼

2. **플로우**:
   - URL 파라미터에서 `brandId` 수신
   - 토스 빌링 위젯으로 카드 정보 입력 → `authKey` 수신
   - `POST /billing/billing-key` 호출 (authKey, customerKey, brandId)
   - 성공 시 `/business` 대시보드로 리다이렉트
   - 실패 시 에러 메시지 표시 + 재시도

3. **보호 로직**:
   - 이미 빌링키가 등록된 브랜드는 `/business`로 리다이렉트
   - PG 브랜드가 접근 시 `/business`로 리다이렉트

### 검증

- Non-PG 브랜드 생성 후 이 페이지에 도착하는지 확인
- 토스 위젯으로 카드 등록 → 빌링키 발급 → 대시보드 이동 확인
- PG 브랜드 접근 시 리다이렉트 확인

---

## 작업 8: 빌링키 미등록 시 서비스 이용 차단

### 파일

- `apps/web/src/app/(protected)/layout.tsx` 또는 미들웨어

### 내용

Non-PG 브랜드이면서 빌링키가 미등록(구독이 없거나 `payment_method_token`이 NULL)인 경우:

- `/business/billing/setup`을 제외한 모든 `/business/*` 경로 접근 시 → `/business/billing/setup`으로 리다이렉트
- 매장 생성, 주문 접수 등 차단

**구현 방식**: 레이아웃 컴포넌트에서 브랜드의 구독 상태를 체크하고, 빌링키 미등록이면 setup 페이지로 보낸다.

### 검증

- 빌링키 미등록 Non-PG 브랜드가 매장 생성을 시도할 수 없는지 확인
- 빌링키 등록 후 정상 접근 가능한지 확인

---

## 작업 9: 플랜 변경 API

### 파일

- `src/modules/billing/billing.service.ts`
- `src/modules/billing/billing.controller.ts`
- `src/modules/billing/dto/subscription.dto.ts`

### 내용

#### 새 엔드포인트

```
PUT /billing/subscription/plan
Body: { planId: string }
권한: Brand Owner
```

#### 서비스 로직

```typescript
async changePlan(userId: string, brandId: string, newPlanId: string) {
  // 1. 현재 구독 조회
  // 2. 현재 플랜과 새 플랜 비교
  // 3. 업그레이드 (가격 상승):
  //    - 즉시 plan_id 변경
  //    - 차액 일할 계산: (남은일수/총일수) * (newPrice - oldPrice)
  //    - 차액 즉시 빌링 (billing_records 생성)
  // 4. 다운그레이드 (가격 하락):
  //    - scheduled_plan_id 컬럼 사용 (또는 메타데이터)
  //    - current_period_end 이후에 적용
  //    - 다음 결제 시 새 플랜 금액으로 청구
}
```

#### DTO

```typescript
export class ChangePlanRequest {
  @IsUUID()
  planId: string;
}

export class ChangePlanResponse {
  effectiveDate: string;      // 적용 시점
  proratedAmount?: number;    // 업그레이드 시 일할 계산 금액
  newPlan: { name: string; price: number; maxMonthlyOrders: number | null };
}
```

### 검증

- 업그레이드 시 즉시 반영 + 차액 결제 확인
- 다운그레이드 시 현재 주기 끝나고 반영 확인
- 동일 플랜 변경 시 400 응답 확인

---

## 작업 10: 월 주문 건수 추적 + 초과 알림

### 파일

- `src/modules/billing/billing.service.ts`
- `src/modules/public-order/public-order.service.ts`

### 내용

#### 주문 건수 추적

주문 생성 시 (`public-order.service.ts`의 `createOrder`), Non-PG 브랜드이면:

```typescript
// 현재 구독 기간 내 주문 건수 카운트
const orderCount = await supabase
  .from('orders')
  .select('id', { count: 'exact' })
  .eq('brand_id', brandId)
  .gte('created_at', subscription.current_period_start)
  .lte('created_at', subscription.current_period_end);

// 한도 초과 체크 (주문을 차단하지는 않음)
if (plan.max_monthly_orders && orderCount >= plan.max_monthly_orders) {
  // 초과 알림 발송 (첫 초과 시 1회만)
  // 향후 알림 시스템 연동 - 현재는 로그만 남김
  logger.warn(`Brand ${brandId} exceeded monthly order limit: ${orderCount}/${plan.max_monthly_orders}`);
}
```

**주문은 차단하지 않는다.** 로그와 알림만 발생시킨다.

#### 3개월 연속 초과 시 자동 업그레이드

`billing.service.ts`에 메서드 추가:

```typescript
async checkOverageAndAutoUpgrade(brandId: string): Promise<void> {
  // 1. 최근 3개월 주문 건수 조회
  // 2. 3개월 연속 한도 초과 확인
  // 3. 초과 시: 다음 상위 플랜으로 자동 업그레이드 예약
  //    - 7일 전 알림 (로그 기록)
  //    - next_billing_at 시점에 상위 플랜으로 변경
}
```

이 메서드는 `BillingScheduler`의 일일 배치에서 호출한다.

### 검증

- 한도 초과 주문이 차단되지 않는지 확인
- 초과 시 로그가 남는지 확인
- 3개월 연속 초과 시 업그레이드 예약 로직 확인

---

## 작업 11: 브랜드 오너 빌링 관리 페이지 보강

### 파일

- `apps/web/src/app/(protected)/business/billing/page.tsx`

### 내용

기존 빌링 관리 페이지에 추가:

1. **현재 플랜 표시**: 플랜 이름 + 월 주문 한도 + 월 이용료
2. **플랜 변경 UI**: 업그레이드/다운그레이드 버튼. `PUT /billing/subscription/plan` 호출
3. **TRIAL 상태 배너**: "무료 체험 N일 남음" (next_billing_at까지 남은 일수)
4. **월 주문 건수 표시**: "이번 달 주문: N / 100건" (한도 대비 현재 사용량)
5. **초과 경고**: 한도 초과 시 "상위 플랜을 확인해보세요" 안내

### 검증

- TRIAL 상태에서 체험 기간 배너 표시 확인
- 플랜 정보 (이름, 한도, 가격) 정상 표시 확인
- 플랜 변경 동작 확인
- 주문 건수 현황 표시 확인

---

## 작업 12: 관리자 페이지에 티어 표시

### 파일

- `apps/web/src/app/admin/stores/[storeId]/page.tsx` (매장 상세)
- `apps/web/src/app/admin/stores/AddStoreModal.tsx` (매장 목록)

### 내용

관리자가 매장/브랜드를 조회할 때 `billingTier` (PG / Non-PG) 표시:

1. **매장 목록**: 각 매장 카드에 "PG" 또는 "Non-PG" 뱃지 추가
2. **매장 상세**: 브랜드 정보 섹션에 "결제 티어: PG" 또는 "결제 티어: Non-PG (Starter)" 표시

브랜드 데이터 조회 시 `billing_tier` 필드를 포함하도록 한다.

### 검증

- 관리자 매장 목록에서 티어 뱃지 표시 확인
- 관리자 매장 상세에서 티어 + 플랜 정보 표시 확인

---

## 작업 순서

1. 작업 0 (기존 마이그레이션 수정) — **가장 먼저**
2. 작업 1 (subscription_plans 마이그레이션) — 작업 0 이후
3. 작업 2 (PlanRow 타입) — 작업 1 이후
4. 작업 3, 4, 5 (TRIAL 로직) — 순서대로
5. 작업 6, 7, 8 (프론트엔드 온보딩) — 순서대로
6. 작업 9 (플랜 변경) — 작업 2 이후 독립
7. 작업 10 (주문 초과) — 작업 2 이후 독립
8. 작업 11, 12 (UI 보강) — 작업 9, 10 이후

## 완료 기준

- `npm run lint` 통과
- `npm run test` 통과 (기존 + 신규 테스트)
- `npm run build` 통과
- 각 작업의 검증 항목 충족
