-- Add sort_order column to products table for custom ordering
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.sort_order IS '상품 정렬 순서 (낮을수록 먼저 표시)';
