BEGIN;

CREATE TABLE IF NOT EXISTS public.commission_tiers (
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

COMMENT ON TABLE public.commission_tiers IS '매출 규모 기반 차등 수수료율 구간 정의';

INSERT INTO public.commission_tiers (name, min_monthly_sales, max_monthly_sales, commission_rate, sort_order) VALUES
  ('Starter',    0,        5000000,  0.0500, 1),  -- 0~500만: 5%
  ('Growth',     5000000,  20000000, 0.0350, 2),  -- 500만~2000만: 3.5%
  ('Enterprise', 20000000, NULL,     0.0250, 3);  -- 2000만~: 2.5%

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- 예: 'Basic Monthly'
  price INTEGER NOT NULL CHECK (price > 0), -- 월 구독금액 (KRW)
  billing_interval TEXT NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_interval IN ('MONTHLY')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.subscription_plans IS 'Non-PG 티어 월 구독 과금제 정의';

CREATE TABLE IF NOT EXISTS public.brand_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),

  -- 상태
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL')),

  -- 현재 과금 기간
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,

  -- 빌링키 (추후 빌링 API)
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

COMMENT ON TABLE public.brand_subscriptions IS '브랜드별 월 구독 상태 (Non-PG 티어)';

CREATE TABLE IF NOT EXISTS public.billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.brand_subscriptions(id) ON DELETE CASCADE,

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

CREATE INDEX idx_billing_records_brand ON public.billing_records(brand_id);
CREATE INDEX idx_billing_records_status ON public.billing_records(status, attempted_at);

COMMENT ON TABLE public.billing_records IS '구독 결제(청구) 이력';

CREATE TABLE IF NOT EXISTS public.settlement_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,

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

CREATE INDEX idx_settlement_periods_status ON public.settlement_periods(status);

COMMENT ON TABLE public.settlement_periods IS 'PG 티어 브랜드별 정산 기간';

CREATE TABLE IF NOT EXISTS public.settlement_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_period_id UUID NOT NULL REFERENCES public.settlement_periods(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),

  -- 금액
  sale_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlement_line_items_period ON public.settlement_line_items(settlement_period_id);
CREATE INDEX idx_settlement_line_items_payment ON public.settlement_line_items(payment_id);

COMMENT ON TABLE public.settlement_line_items IS 'PG 정산 상세 (결제별 수수료 계산)';

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS billing_tier TEXT NOT NULL DEFAULT 'PG'
    CHECK (billing_tier IN ('PG', 'NON_PG')),
  ADD COLUMN IF NOT EXISTS billing_tier_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);

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

-- 1. CASH 제거 (Section 3에서 처리)

-- 2. 티어 배정
-- CARD가 포함된 브랜드는 PG
-- TRANSFER만 있는 브랜드는 NON_PG
UPDATE public.brands
SET billing_tier = CASE
  WHEN 'CARD' = ANY(shop_payment_methods) THEN 'PG'
  ELSE 'NON_PG'
END,
billing_tier_decided_at = NOW();

-- 3. PG 브랜드에 기본 수수료율 설정 (초기값, 이후 구간별로 자동 적용)
UPDATE public.brands
SET commission_rate = 0.0350
WHERE billing_tier = 'PG' AND commission_rate IS NULL;

-- PG 브랜드는 commission_rate 필수 (마이그레이션 완료 후 적용)
ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_pg_commission_rate_check;

ALTER TABLE public.brands
  ADD CONSTRAINT brands_pg_commission_rate_check
  CHECK (billing_tier != 'PG' OR commission_rate IS NOT NULL);

-- PG 브랜드 산하 매장: CARD만
UPDATE public.branches b
SET allowed_payment_methods = ARRAY['CARD']::TEXT[]
FROM public.brands br
WHERE br.id = b.brand_id
  AND br.billing_tier = 'PG';

-- Non-PG 브랜드 산하 매장: TRANSFER만
UPDATE public.branches b
SET allowed_payment_methods = ARRAY['TRANSFER']::TEXT[]
FROM public.brands br
WHERE br.id = b.brand_id
  AND br.billing_tier = 'NON_PG';

ALTER TABLE public.commission_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_tiers_select_all ON public.commission_tiers;
CREATE POLICY commission_tiers_select_all
  ON public.commission_tiers
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS commission_tiers_manage_system_admin ON public.commission_tiers;
CREATE POLICY commission_tiers_manage_system_admin
  ON public.commission_tiers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  );

DROP POLICY IF EXISTS subscription_plans_select_all ON public.subscription_plans;
CREATE POLICY subscription_plans_select_all
  ON public.subscription_plans
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS subscription_plans_manage_system_admin ON public.subscription_plans;
CREATE POLICY subscription_plans_manage_system_admin
  ON public.subscription_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  );

DROP POLICY IF EXISTS brand_subscriptions_select_members ON public.brand_subscriptions;
CREATE POLICY brand_subscriptions_select_members
  ON public.brand_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = brand_subscriptions.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = brand_subscriptions.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS brand_subscriptions_manage_system_admin ON public.brand_subscriptions;
CREATE POLICY brand_subscriptions_manage_system_admin
  ON public.brand_subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  );

DROP POLICY IF EXISTS billing_records_select_members ON public.billing_records;
CREATE POLICY billing_records_select_members
  ON public.billing_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = billing_records.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = billing_records.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS billing_records_manage_system_admin ON public.billing_records;
CREATE POLICY billing_records_manage_system_admin
  ON public.billing_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  );

DROP POLICY IF EXISTS settlement_periods_select_members ON public.settlement_periods;
CREATE POLICY settlement_periods_select_members
  ON public.settlement_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = settlement_periods.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = settlement_periods.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS settlement_periods_manage_system_admin ON public.settlement_periods;
CREATE POLICY settlement_periods_manage_system_admin
  ON public.settlement_periods
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  );

DROP POLICY IF EXISTS settlement_line_items_select_members ON public.settlement_line_items;
CREATE POLICY settlement_line_items_select_members
  ON public.settlement_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.settlement_periods sp
      JOIN public.brands b
        ON b.id = sp.brand_id
      WHERE sp.id = settlement_line_items.settlement_period_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.settlement_periods sp
      JOIN public.brand_members bm
        ON bm.brand_id = sp.brand_id
      WHERE sp.id = settlement_line_items.settlement_period_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS settlement_line_items_manage_system_admin ON public.settlement_line_items;
CREATE POLICY settlement_line_items_manage_system_admin
  ON public.settlement_line_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
  );

GRANT SELECT ON public.commission_tiers TO anon, authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.brand_subscriptions TO authenticated;
GRANT SELECT ON public.billing_records TO authenticated;
GRANT SELECT ON public.settlement_periods TO authenticated;
GRANT SELECT ON public.settlement_line_items TO authenticated;

COMMIT;
