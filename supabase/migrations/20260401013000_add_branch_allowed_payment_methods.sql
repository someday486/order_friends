-- Add branch-level payment method visibility settings and backfill from brand defaults.

BEGIN;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS allowed_payment_methods TEXT[];

UPDATE public.branches AS b
SET allowed_payment_methods = COALESCE(
  (
    SELECT array_agg(DISTINCT method)
    FROM unnest(COALESCE(br.shop_payment_methods, ARRAY[]::TEXT[])) AS method
    WHERE method IN ('CARD', 'TRANSFER')
  ),
  ARRAY['CARD', 'TRANSFER']::TEXT[]
)
FROM public.brands AS br
WHERE br.id = b.brand_id
  AND b.allowed_payment_methods IS NULL;

UPDATE public.branches
SET allowed_payment_methods = ARRAY['CARD', 'TRANSFER']::TEXT[]
WHERE allowed_payment_methods IS NULL
   OR cardinality(allowed_payment_methods) = 0;

ALTER TABLE public.branches
  ALTER COLUMN allowed_payment_methods SET DEFAULT ARRAY['CARD', 'TRANSFER']::TEXT[],
  ALTER COLUMN allowed_payment_methods SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'branches'
      AND constraint_name = 'branches_allowed_payment_methods_valid_check'
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_allowed_payment_methods_valid_check
      CHECK (
        cardinality(allowed_payment_methods) > 0
        AND allowed_payment_methods <@ ARRAY['CARD', 'TRANSFER']::TEXT[]
      );
  END IF;
END $$;

COMMENT ON COLUMN public.branches.allowed_payment_methods IS
  'Branch-level payment methods exposed on direct branch ordering pages.';

COMMIT;
