BEGIN;

ALTER TABLE public.brand_subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_plan_effective_at TIMESTAMPTZ;

COMMENT ON COLUMN public.brand_subscriptions.scheduled_plan_id IS 'Plan scheduled to take effect on the next billing cycle.';
COMMENT ON COLUMN public.brand_subscriptions.scheduled_plan_effective_at IS 'Timestamp when the scheduled plan should become active.';

CREATE INDEX IF NOT EXISTS idx_brand_subscriptions_scheduled_plan
  ON public.brand_subscriptions(scheduled_plan_effective_at)
  WHERE scheduled_plan_id IS NOT NULL;

COMMIT;
