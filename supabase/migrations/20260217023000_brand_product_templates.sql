-- Brand-level menu templates with branch-level opt-in

BEGIN;

CREATE TABLE IF NOT EXISTS public.brand_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_products_brand
  ON public.brand_products(brand_id);

CREATE INDEX IF NOT EXISTS idx_brand_products_brand_active
  ON public.brand_products(brand_id, is_active);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_product_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'products'
      AND constraint_name = 'products_brand_product_id_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_brand_product_id_fkey
      FOREIGN KEY (brand_product_id)
      REFERENCES public.brand_products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_branch_brand_product_unique
  ON public.products(branch_id, brand_product_id)
  WHERE brand_product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.brand_products_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_brand_products_updated_at ON public.brand_products;
CREATE TRIGGER trigger_brand_products_updated_at
  BEFORE UPDATE ON public.brand_products
  FOR EACH ROW
  EXECUTE FUNCTION public.brand_products_set_updated_at();

COMMIT;
