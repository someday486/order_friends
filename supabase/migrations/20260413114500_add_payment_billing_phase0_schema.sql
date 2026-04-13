BEGIN;

CREATE TABLE IF NOT EXISTS public.commission_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  min_monthly_sales INTEGER NOT NULL DEFAULT 0,
  max_monthly_sales INTEGER,
  commission_rate NUMERIC(5,4) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT commission_tiers_rate_range CHECK (commission_rate > 0 AND commission_rate < 1),
  CONSTRAINT commission_tiers_sales_range CHECK (
    min_monthly_sales >= 0
    AND (max_monthly_sales IS NULL OR max_monthly_sales > min_monthly_sales)
  )
);

COMMENT ON TABLE public.commission_tiers IS 'Commission rate tiers by monthly sales range.';

INSERT INTO public.commission_tiers (
  name,
  min_monthly_sales,
  max_monthly_sales,
  commission_rate,
  sort_order
)
SELECT *
FROM (
  VALUES
    ('Starter', 0, 5000000, 0.0500, 1),
    ('Growth', 5000000, 20000000, 0.0350, 2),
    ('Enterprise', 20000000, NULL, 0.0250, 3)
) AS seed(name, min_monthly_sales, max_monthly_sales, commission_rate, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commission_tiers
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  billing_interval TEXT NOT NULL DEFAULT 'MONTHLY'
    CHECK (billing_interval IN ('MONTHLY')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.subscription_plans IS 'Monthly subscription plans for NON_PG brands.';

CREATE TABLE IF NOT EXISTS public.brand_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIAL')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  payment_method_token TEXT,
  next_billing_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT brand_subscriptions_unique_active UNIQUE (brand_id)
);

COMMENT ON TABLE public.brand_subscriptions IS 'Subscription state for NON_PG brands.';

CREATE TABLE IF NOT EXISTS public.billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.brand_subscriptions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
  provider TEXT NOT NULL DEFAULT 'TOSS',
  provider_payment_key TEXT,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_records_brand
  ON public.billing_records(brand_id);
CREATE INDEX IF NOT EXISTS idx_billing_records_status
  ON public.billing_records(status, attempted_at);

COMMENT ON TABLE public.billing_records IS 'Subscription billing charge history.';

CREATE TABLE IF NOT EXISTS public.settlement_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales INTEGER NOT NULL DEFAULT 0,
  total_refunds INTEGER NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  net_settlement INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CALCULATED', 'SETTLED')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_settlement_periods_status
  ON public.settlement_periods(status);

COMMENT ON TABLE public.settlement_periods IS 'Monthly settlement periods for PG brands.';

CREATE TABLE IF NOT EXISTS public.settlement_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_period_id UUID NOT NULL REFERENCES public.settlement_periods(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  sale_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_line_items_period
  ON public.settlement_line_items(settlement_period_id);
CREATE INDEX IF NOT EXISTS idx_settlement_line_items_payment
  ON public.settlement_line_items(payment_id);

COMMENT ON TABLE public.settlement_line_items IS 'Per-payment settlement details.';

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS billing_tier TEXT NOT NULL DEFAULT 'PG'
    CHECK (billing_tier IN ('PG', 'NON_PG')),
  ADD COLUMN IF NOT EXISTS billing_tier_decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4);

UPDATE public.brands
SET shop_payment_methods = array_remove(shop_payment_methods, 'CASH')
WHERE 'CASH' = ANY(shop_payment_methods);

UPDATE public.brands
SET shop_payment_methods = ARRAY['CARD', 'TRANSFER']::TEXT[]
WHERE cardinality(shop_payment_methods) = 0;

ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_shop_payment_methods_valid_check;

ALTER TABLE public.brands
  ADD CONSTRAINT brands_shop_payment_methods_valid_check
  CHECK (
    cardinality(shop_payment_methods) > 0
    AND shop_payment_methods <@ ARRAY['CARD', 'TRANSFER']::TEXT[]
  );

UPDATE public.brands
SET billing_tier = CASE
  WHEN 'CARD' = ANY(shop_payment_methods) THEN 'PG'
  ELSE 'NON_PG'
END,
    billing_tier_decided_at = NOW();

UPDATE public.brands
SET commission_rate = 0.0350
WHERE billing_tier = 'PG'
  AND commission_rate IS NULL;

ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_pg_commission_rate_check;

ALTER TABLE public.brands
  ADD CONSTRAINT brands_pg_commission_rate_check
  CHECK (billing_tier != 'PG' OR commission_rate IS NOT NULL);

UPDATE public.branches b
SET allowed_payment_methods = ARRAY['CARD']::TEXT[]
FROM public.brands br
WHERE br.id = b.brand_id
  AND br.billing_tier = 'PG';

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
