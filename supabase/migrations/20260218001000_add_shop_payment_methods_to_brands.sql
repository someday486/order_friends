-- Add brand-level online shop payment method visibility settings.

BEGIN;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS shop_payment_methods TEXT[] NOT NULL
  DEFAULT ARRAY['CARD', 'TRANSFER', 'CASH']::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'brands'
      AND constraint_name = 'brands_shop_payment_methods_valid_check'
  ) THEN
    ALTER TABLE public.brands
      ADD CONSTRAINT brands_shop_payment_methods_valid_check
      CHECK (
        cardinality(shop_payment_methods) > 0
        AND shop_payment_methods <@ ARRAY['CARD', 'TRANSFER', 'CASH']::TEXT[]
      );
  END IF;
END $$;

COMMIT;
