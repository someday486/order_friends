-- Backfill existing branch products into brand-level menu templates.
-- This keeps previously registered menus visible in the unified /customer/products screen.

BEGIN;

CREATE TEMP TABLE tmp_products_without_brand_template AS
SELECT
  p.id AS product_id,
  b.brand_id,
  p.name,
  p.description,
  p.base_price,
  p.image_url,
  COALESCE(p.sort_order, 0) AS sort_order,
  (NOT COALESCE(p.is_hidden, false)) AS is_active,
  COALESCE(p.created_at, NOW()) AS created_at,
  COALESCE(p.updated_at, COALESCE(p.created_at, NOW())) AS updated_at
FROM public.products p
JOIN public.branches b ON b.id = p.branch_id
WHERE p.brand_product_id IS NULL;

-- 1) Create one brand template row per existing product row.
INSERT INTO public.brand_products (
  brand_id,
  name,
  description,
  base_price,
  image_url,
  is_active,
  sort_order,
  created_at,
  updated_at
)
SELECT
  t.brand_id,
  t.name,
  t.description,
  t.base_price,
  t.image_url,
  t.is_active,
  t.sort_order,
  t.created_at,
  t.updated_at
FROM tmp_products_without_brand_template t;

-- 2) Match each source product to exactly one template using rank within identical value groups.
WITH source_ranked AS (
  SELECT
    t.product_id,
    t.brand_id,
    t.name,
    t.description,
    t.base_price,
    t.image_url,
    t.is_active,
    t.sort_order,
    t.created_at,
    t.updated_at,
    row_number() OVER (
      PARTITION BY
        t.brand_id,
        t.name,
        t.description,
        t.base_price,
        t.image_url,
        t.is_active,
        t.sort_order,
        t.created_at,
        t.updated_at
      ORDER BY t.product_id
    ) AS slot
  FROM tmp_products_without_brand_template t
),
target_ranked AS (
  SELECT
    bp.id AS brand_product_id,
    bp.brand_id,
    bp.name,
    bp.description,
    bp.base_price,
    bp.image_url,
    bp.is_active,
    bp.sort_order,
    bp.created_at,
    bp.updated_at,
    row_number() OVER (
      PARTITION BY
        bp.brand_id,
        bp.name,
        bp.description,
        bp.base_price,
        bp.image_url,
        bp.is_active,
        bp.sort_order,
        bp.created_at,
        bp.updated_at
      ORDER BY bp.id
    ) AS slot
  FROM public.brand_products bp
  JOIN (
    SELECT DISTINCT brand_id
    FROM tmp_products_without_brand_template
  ) b ON b.brand_id = bp.brand_id
),
matched AS (
  SELECT
    s.product_id,
    t.brand_product_id
  FROM source_ranked s
  JOIN target_ranked t
    ON t.brand_id = s.brand_id
   AND t.name IS NOT DISTINCT FROM s.name
   AND t.description IS NOT DISTINCT FROM s.description
   AND t.base_price IS NOT DISTINCT FROM s.base_price
   AND t.image_url IS NOT DISTINCT FROM s.image_url
   AND t.is_active = s.is_active
   AND t.sort_order IS NOT DISTINCT FROM s.sort_order
   AND t.created_at IS NOT DISTINCT FROM s.created_at
   AND t.updated_at IS NOT DISTINCT FROM s.updated_at
   AND t.slot = s.slot
)
UPDATE public.products p
SET brand_product_id = m.brand_product_id
FROM matched m
WHERE p.id = m.product_id
  AND p.brand_product_id IS NULL;

COMMIT;
