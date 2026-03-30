-- Add history table for brand product urgent discount campaigns.

BEGIN;

CREATE TABLE IF NOT EXISTS public.brand_product_urgent_discount_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_product_id UUID NOT NULL REFERENCES public.brand_products(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  discount_price INTEGER NOT NULL CHECK (discount_price >= 0),
  discount_start_at TIMESTAMPTZ NULL,
  discount_end_at TIMESTAMPTZ NULL,
  recorded_reason TEXT NOT NULL DEFAULT 'SET',
  recorded_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bp_urgent_discount_histories_template_created
  ON public.brand_product_urgent_discount_histories (brand_product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bp_urgent_discount_histories_brand_created
  ON public.brand_product_urgent_discount_histories (brand_id, created_at DESC);

COMMIT;
