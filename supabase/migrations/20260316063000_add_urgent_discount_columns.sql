-- Add urgent discount columns for brand templates and branch products.

BEGIN;

ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS urgent_discount_price INTEGER,
  ADD COLUMN IF NOT EXISTS urgent_discount_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS urgent_discount_end_at TIMESTAMPTZ;

ALTER TABLE public.brand_products
  DROP CONSTRAINT IF EXISTS brand_products_urgent_discount_price_check;

ALTER TABLE public.brand_products
  ADD CONSTRAINT brand_products_urgent_discount_price_check
  CHECK (
    urgent_discount_price IS NULL
    OR (urgent_discount_price >= 0 AND urgent_discount_price < base_price)
  );

ALTER TABLE public.brand_products
  DROP CONSTRAINT IF EXISTS brand_products_urgent_discount_range_check;

ALTER TABLE public.brand_products
  ADD CONSTRAINT brand_products_urgent_discount_range_check
  CHECK (
    urgent_discount_start_at IS NULL
    OR urgent_discount_end_at IS NULL
    OR urgent_discount_start_at < urgent_discount_end_at
  );

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS urgent_discount_price INTEGER,
  ADD COLUMN IF NOT EXISTS urgent_discount_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS urgent_discount_end_at TIMESTAMPTZ;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_urgent_discount_price_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_urgent_discount_price_check
  CHECK (
    urgent_discount_price IS NULL
    OR (urgent_discount_price >= 0 AND urgent_discount_price < base_price)
  );

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_urgent_discount_range_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_urgent_discount_range_check
  CHECK (
    urgent_discount_start_at IS NULL
    OR urgent_discount_end_at IS NULL
    OR urgent_discount_start_at < urgent_discount_end_at
  );

COMMIT;
