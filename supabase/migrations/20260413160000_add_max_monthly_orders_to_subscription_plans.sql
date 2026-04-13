BEGIN;

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_monthly_orders INTEGER;

COMMENT ON COLUMN public.subscription_plans.max_monthly_orders IS 'Maximum monthly order count (NULL = unlimited).';

UPDATE public.subscription_plans
SET max_monthly_orders = 100
WHERE name = 'Starter';

UPDATE public.subscription_plans
SET max_monthly_orders = 500
WHERE name = 'Growth';

UPDATE public.subscription_plans
SET max_monthly_orders = NULL
WHERE name = 'Pro';

COMMIT;
