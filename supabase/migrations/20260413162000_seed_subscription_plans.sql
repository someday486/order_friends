BEGIN;

INSERT INTO public.subscription_plans (name, price, max_monthly_orders)
SELECT 'Starter', 33000, 100
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE name = 'Starter'
);

INSERT INTO public.subscription_plans (name, price, max_monthly_orders)
SELECT 'Growth', 44000, 500
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE name = 'Growth'
);

INSERT INTO public.subscription_plans (name, price, max_monthly_orders)
SELECT 'Pro', 55000, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE name = 'Pro'
);

COMMIT;
