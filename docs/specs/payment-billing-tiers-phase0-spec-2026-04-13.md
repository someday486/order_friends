# Phase 0: 데이터 모델 + 마이그레이션

작성일: 2026-04-13
상태: Draft v1
상위 문서: `docs/specs/payment-billing-tiers-master-spec-2026-04-13.md`

## 1. 문서 목적

이 문서는 결제 이원화의 데이터 기반을 정의한다. Phase 0에서는 런타임 동작 변경 없이 스키마와 데이터만 변경한다.

## 2. 포함 / 제외 범위

### 포함

- `brands` 테이블 컬럼 추가 (`billing_tier`, `commission_rate`, `billing_tier_decided_at`)
- 구독/빌링 관련 신규 테이블 생성
- 정산 관련 신규 테이블 생성
- 수수료 구간 테이블 생성
- 기존 데이터 마이그레이션 (CASH 제거, 티어 배정)
- CHECK constraint 업데이트
- Backend enum/DTO 추가

### 제외

- API 엔드포인트 변경
- 프론트엔드 UI 변경
- 실제 빌링/정산 로직
- 브랜드 온보딩 플로우 변경

## 3. brands 테이블 변경

### 신규 컬럼

```sql
ALTER TABLE public.brands
  ADD COLUMN billing_tier TEXT NOT NULL DEFAULT 'PG'
    CHECK (billing_tier IN ('PG', 'NON_PG')),
  ADD COLUMN billing_tier_decided_at TIMESTAMPTZ,
  ADD COLUMN commission_rate NUMERIC(5,4);
```

### 제약 조건

```sql
-- PG 브랜드는 commission_rate 필수 (마이그레이션 완료 후 적용)
ALTER TABLE public.brands
  ADD CONSTRAINT brands_pg_commission_rate_check
  CHECK (billing_tier != 'PG' OR commission_rate IS NOT NULL);
```

### CASH 제거

```sql
-- brands.shop_payment_methods에서 CASH 제거
UPDATE public.brands
SET shop_payment_methods = array_remove(shop_payment_methods, 'CASH')
WHERE 'CASH' = ANY(shop_payment_methods);

-- 빈 배열 방지
UPDATE public.brands
SET shop_payment_methods = ARRAY['CARD', 'TRANSFER']::TEXT[]
WHERE cardinality(shop_payment_methods) = 0;

-- CHECK constraint 변경: CASH 제거
ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_shop_payment_methods_valid_check;

ALTER TABLE public.brands
  ADD CONSTRAINT brands_shop_payment_methods_valid_check
  CHECK (
    cardinality(shop_payment_methods) > 0
    AND shop_payment_methods <@ ARRAY['CARD', 'TRANSFER']::TEXT[]
  );
```

## 4. 수수료 구간 테이블

```sql
CREATE TABLE IF NOT EXISTS commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 구간 정의
  name TEXT NOT NULL,                           -- 예: 'Starter', 'Growth', 'Enterprise'
  min_monthly_sales INTEGER NOT NULL DEFAULT 0, -- 구간 하한 (KRW, 이상)
  max_monthly_sales INTEGER,                    -- 구간 상한 (KRW, 미만, NULL = 무제한)
  commission_rate NUMERIC(5,4) NOT NULL,        -- 예: 0.0500 = 5%

  -- 활성 여부
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- 정렬
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 구간 중복 방지
  CONSTRAINT commission_tiers_rate_range CHECK (commission_rate > 0 AND commission_rate < 1),
  CONSTRAINT commission_tiers_sales_range CHECK (
    min_monthly_sales >= 0
    AND (max_monthly_sales IS NULL OR max_monthly_sales > min_monthly_sales)
  )
);

COMMENT ON TABLE commission_tiers IS '매출 규모 기반 차등 수수료율 구간 정의';
```

### 초기 데이터 (예시)

```sql
INSERT INTO commission_tiers (name, min_monthly_sales, max_monthly_sales, commission_rate, sort_order) VALUES
  ('Starter',    0,        5000000,  0.0500, 1),  -- 0~500만: 5%
  ('Growth',     5000000,  20000000, 0.0350, 2),  -- 500만~2000만: 3.5%
  ('Enterprise', 20000000, NULL,     0.0250, 3);  -- 2000만+: 2.5%
```

## 5. 구독 관련 테이블

### subscription_plans

```sql
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 예: 'Starter', 'Growth', 'Pro'
  price INTEGER NOT NULL CHECK (price > 0), -- 월 금액 (KRW)
  max_monthly_orders INTEGER,            -- 월 주문 한도 (NULL = 무제한)
  billing_interval TEXT NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_interval IN ('MONTHLY')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subscription_plans IS 'Non-PG 티어 월 구독 요금제 정의';
COMMENT ON COLUMN subscription_plans.max_monthly_orders IS '월 주문 한도 (NULL = 무제한)';
```

### subscription_plans 초기 데이터

```sql
INSERT INTO subscription_plans (name, price, max_monthly_orders, sort_order) VALUES
  ('Starter', 33000, 100,  1),  -- 월 100건, ₩33,000
  ('Growth',  44000, 500,  2),  -- 월 500건, ₩44,000
  ('Pro',     55000, NULL, 3);  -- 무제한, ₩55,000
```

### brand_subscriptions

```sql
CREATE TABLE IF NOT EXISTS brand_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  -- 상태
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL')),

  -- 현재 과금 기간
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,

  -- 빌링키 (토스 빌링 API)
  payment_method_token TEXT,  -- 암호화된 빌링키

  -- 다음 청구일
  next_billing_at TIMESTAMPTZ NOT NULL,

  -- 해지
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 브랜드당 활성 구독 1개
  CONSTRAINT brand_subscriptions_unique_active
    UNIQUE (brand_id)
);

COMMENT ON TABLE brand_subscriptions IS '브랜드별 월 구독 상태 (Non-PG 티어)';
```

### billing_records

```sql
CREATE TABLE IF NOT EXISTS billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES brand_subscriptions(id) ON DELETE CASCADE,

  -- 결제 정보
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),

  -- 제공자
  provider TEXT NOT NULL DEFAULT 'TOSS',
  provider_payment_key TEXT,

  -- 과금 기간
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,

  -- 처리 이력
  attempted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_records_brand ON billing_records(brand_id);
CREATE INDEX idx_billing_records_status ON billing_records(status, attempted_at);

COMMENT ON TABLE billing_records IS '구독 결제(청구) 이력';
```

## 6. 정산 관련 테이블

### settlement_periods

```sql
CREATE TABLE IF NOT EXISTS settlement_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  -- 기간
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- 집계
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_refunds INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL,  -- 해당 기간 적용 수수료율 (스냅샷)
  commission_amount INTEGER NOT NULL DEFAULT 0,
  net_settlement INTEGER NOT NULL DEFAULT 0,

  -- 상태
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CALCULATED', 'SETTLED')),
  settled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (brand_id, period_start)
);

CREATE INDEX idx_settlement_periods_status ON settlement_periods(status);

COMMENT ON TABLE settlement_periods IS 'PG 티어 브랜드 월별 정산 기간';
```

### settlement_line_items

```sql
CREATE TABLE IF NOT EXISTS settlement_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_period_id UUID NOT NULL REFERENCES settlement_periods(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  order_id UUID NOT NULL REFERENCES orders(id),

  -- 금액
  sale_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_line_items_period ON settlement_line_items(settlement_period_id);
CREATE INDEX idx_settlement_line_items_payment ON settlement_line_items(payment_id);

COMMENT ON TABLE settlement_line_items IS 'PG 정산 상세 (결제별 수수료 계산)';
```

## 7. RLS 정책

모든 신규 테이블에 RLS 활성화:

- `commission_tiers`: 전체 읽기 허용 (공개 데이터), 쓰기는 시스템/관리자만
- `subscription_plans`: 전체 읽기 허용, 쓰기는 시스템/관리자만
- `brand_subscriptions`: 해당 브랜드 멤버만 읽기, 시스템만 쓰기
- `billing_records`: 해당 브랜드 멤버만 읽기, 시스템만 쓰기
- `settlement_periods`: 해당 브랜드 멤버만 읽기, 시스템만 쓰기
- `settlement_line_items`: 해당 브랜드 멤버만 읽기, 시스템만 쓰기

## 8. 기존 데이터 마이그레이션

### 티어 배정 로직

**결정: 기존 브랜드는 전부 PG로 배정한다.** Non-PG는 신규 가입자부터만 적용한다. 기존 TRANSFER 전용 브랜드도 PG로 전환하며, 토스 결제(CARD)를 사용하도록 한다.

```sql
-- 1. CASH 제거 (Section 3에서 처리)

-- 2. 기존 브랜드 전부 PG 배정
UPDATE public.brands
SET billing_tier = 'PG',
    billing_tier_decided_at = NOW();

-- 3. PG 브랜드에 기본 수수료율 설정
UPDATE public.brands
SET commission_rate = 0.0350
WHERE commission_rate IS NULL;
```

### branches.allowed_payment_methods 정합성

```sql
-- 기존 브랜드 전부 PG이므로: 모든 매장 CARD만
UPDATE public.branches
SET allowed_payment_methods = ARRAY['CARD']::TEXT[];
```

### brands.shop_payment_methods 정합성

```sql
-- 기존 브랜드 전부 PG이므로: CARD + TRANSFER 유지하되 CARD 필수
UPDATE public.brands
SET shop_payment_methods = ARRAY['CARD', 'TRANSFER']::TEXT[]
WHERE NOT ('CARD' = ANY(shop_payment_methods));
```

## 9. Backend Enum/DTO 추가

### 신규 Enum (Phase 0에서 정의, Phase 1~3에서 사용)

```typescript
// src/modules/billing/billing.types.ts
export enum BillingTier {
  PG = 'PG',
  NON_PG = 'NON_PG',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  TRIAL = 'TRIAL',
}

export enum BillingRecordStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum SettlementStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  SETTLED = 'SETTLED',
}
```

## 10. 마이그레이션 실행 순서

1. `commission_tiers` 테이블 생성 + 초기 데이터
2. `subscription_plans` 테이블 생성
3. `brand_subscriptions` 테이블 생성
4. `billing_records` 테이블 생성
5. `settlement_periods` 테이블 생성
6. `settlement_line_items` 테이블 생성
7. `brands` 컬럼 추가 (`billing_tier`, `billing_tier_decided_at`, `commission_rate`)
8. CASH 제거 + CHECK constraint 변경
9. 기존 데이터 마이그레이션 (티어 배정, 수수료율, 매장 결제수단 정합성)
10. PG commission_rate NOT NULL 제약 조건 추가
11. RLS 정책 적용

## 11. 롤백 계획

- 모든 마이그레이션은 단일 트랜잭션 내에서 실행
- 롤백 시: 신규 테이블 DROP, 신규 컬럼 DROP, CHECK constraint 원복
- CASH 제거는 복구 불가 → 마이그레이션 전 백업 필수
- `billing_tier` DEFAULT가 'PG'이므로, 롤백 전까지 기존 코드는 영향 없음

## 12. 검증 체크리스트

- [ ] 모든 기존 브랜드의 `billing_tier = 'PG'` 확인 (기존 브랜드 전부 PG)
- [ ] 모든 기존 브랜드의 `commission_rate` NOT NULL 확인
- [ ] CASH가 어떤 브랜드의 `shop_payment_methods`에도 없는지 확인
- [ ] 모든 기존 매장의 `allowed_payment_methods`가 `['CARD']`인지 확인
- [ ] `commission_tiers` 초기 데이터 정상 입력 확인
- [ ] 기존 테스트 통과 확인
- [ ] `npm run migrations:check` 통과
