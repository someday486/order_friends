-- Add online shop visibility flag for brand-level products.

BEGIN;

ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS is_online_shop_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_online_visible
  ON public.brand_products (brand_id, is_online_shop_visible)
  WHERE is_active = TRUE;

COMMIT;
