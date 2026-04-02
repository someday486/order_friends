-- Add procurement supplier/item matching tables for B2B imports.

BEGIN;

CREATE TABLE IF NOT EXISTS public.procurement_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  supplier_code TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  order_channel TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
  minimum_order_amount INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  memo TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procurement_suppliers_name_not_blank
    CHECK (length(btrim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_suppliers_brand_name_unique
  ON public.procurement_suppliers (brand_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_suppliers_brand_code_unique
  ON public.procurement_suppliers (brand_id, supplier_code)
  WHERE supplier_code IS NOT NULL AND length(btrim(supplier_code)) > 0;

CREATE INDEX IF NOT EXISTS idx_procurement_suppliers_brand_active
  ON public.procurement_suppliers (brand_id, is_active, name);

COMMENT ON TABLE public.procurement_suppliers IS
  'Supplier master scoped by brand for procurement and B2B uploads.';

COMMENT ON COLUMN public.procurement_suppliers.supplier_code IS
  'Optional external or internal supplier code used for ERP integrations.';

CREATE TABLE IF NOT EXISTS public.procurement_supplier_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.procurement_suppliers(id) ON DELETE CASCADE,
  brand_product_id UUID NOT NULL REFERENCES public.brand_products(id) ON DELETE RESTRICT,
  supplier_item_name TEXT NOT NULL,
  supplier_item_code TEXT,
  order_unit TEXT,
  pack_description TEXT,
  min_order_qty INTEGER NOT NULL DEFAULT 1 CHECK (min_order_qty >= 1),
  current_unit_price INTEGER NOT NULL DEFAULT 0 CHECK (current_unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_price_confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procurement_supplier_items_name_not_blank
    CHECK (length(btrim(supplier_item_name)) > 0),
  CONSTRAINT procurement_supplier_items_currency_not_blank
    CHECK (length(btrim(currency)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_supplier_items_supplier_code_unique
  ON public.procurement_supplier_items (supplier_id, supplier_item_code)
  WHERE supplier_item_code IS NOT NULL AND length(btrim(supplier_item_code)) > 0;

CREATE INDEX IF NOT EXISTS idx_procurement_supplier_items_supplier_active
  ON public.procurement_supplier_items (supplier_id, is_active, supplier_item_name);

CREATE INDEX IF NOT EXISTS idx_procurement_supplier_items_brand_product
  ON public.procurement_supplier_items (brand_product_id, supplier_id);

COMMENT ON TABLE public.procurement_supplier_items IS
  'Canonical supplier item rows mapped to internal brand_products.';

COMMENT ON COLUMN public.procurement_supplier_items.current_unit_price IS
  'Latest confirmed supplier unit price used as the default snapshot for imports.';

CREATE TABLE IF NOT EXISTS public.procurement_supplier_item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.procurement_suppliers(id) ON DELETE CASCADE,
  supplier_item_id UUID NOT NULL REFERENCES public.procurement_supplier_items(id) ON DELETE CASCADE,
  alias_type TEXT NOT NULL DEFAULT 'NAME',
  alias_value TEXT NOT NULL,
  alias_value_normalized TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  match_priority INTEGER NOT NULL DEFAULT 100 CHECK (match_priority >= 1),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procurement_supplier_item_aliases_type_check
    CHECK (alias_type IN ('NAME', 'CODE', 'FREE_TEXT')),
  CONSTRAINT procurement_supplier_item_aliases_value_not_blank
    CHECK (length(btrim(alias_value)) > 0),
  CONSTRAINT procurement_supplier_item_aliases_normalized_not_blank
    CHECK (length(btrim(alias_value_normalized)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_supplier_item_aliases_supplier_value_unique
  ON public.procurement_supplier_item_aliases (supplier_id, alias_type, alias_value_normalized);

CREATE INDEX IF NOT EXISTS idx_procurement_supplier_item_aliases_supplier_item
  ON public.procurement_supplier_item_aliases (supplier_item_id, match_priority, created_at);

COMMENT ON TABLE public.procurement_supplier_item_aliases IS
  'Supplier-scoped names or codes that should keep auto-matching to the same internal item.';

COMMENT ON COLUMN public.procurement_supplier_item_aliases.alias_value_normalized IS
  'Application-normalized matching key, for example lowercased text without spaces.';

CREATE TABLE IF NOT EXISTS public.procurement_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.procurement_suppliers(id) ON DELETE CASCADE,
  supplier_item_id UUID NOT NULL REFERENCES public.procurement_supplier_items(id) ON DELETE CASCADE,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  effective_from DATE NOT NULL,
  effective_to DATE,
  change_reason TEXT,
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procurement_price_history_currency_not_blank
    CHECK (length(btrim(currency)) > 0),
  CONSTRAINT procurement_price_history_effective_range_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_price_history_item_effective_from_unique
  ON public.procurement_price_history (supplier_item_id, effective_from);

CREATE INDEX IF NOT EXISTS idx_procurement_price_history_supplier_item_date
  ON public.procurement_price_history (supplier_item_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_price_history_supplier_date
  ON public.procurement_price_history (supplier_id, effective_from DESC);

COMMENT ON TABLE public.procurement_price_history IS
  'Historical supplier prices used for audit and future price-effective logic.';

CREATE TABLE IF NOT EXISTS public.procurement_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.procurement_suppliers(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL DEFAULT 'UPLOAD',
  source_file_name TEXT NOT NULL,
  source_headers JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_date DATE NOT NULL,
  header_row_index INTEGER NOT NULL DEFAULT 0 CHECK (header_row_index >= 0),
  status TEXT NOT NULL DEFAULT 'UPLOADED',
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  matched_row_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_row_count >= 0),
  unmatched_row_count INTEGER NOT NULL DEFAULT 0 CHECK (unmatched_row_count >= 0),
  conflict_row_count INTEGER NOT NULL DEFAULT 0 CHECK (conflict_row_count >= 0),
  total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procurement_import_batches_source_type_check
    CHECK (source_type IN ('UPLOAD', 'MANUAL', 'API')),
  CONSTRAINT procurement_import_batches_status_check
    CHECK (status IN (
      'UPLOADED',
      'MATCHING',
      'MATCHED',
      'PARTIAL_MATCHED',
      'CONFIRMED',
      'FAILED',
      'ARCHIVED'
    )),
  CONSTRAINT procurement_import_batches_file_name_not_blank
    CHECK (length(btrim(source_file_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_procurement_import_batches_supplier_uploaded
  ON public.procurement_import_batches (supplier_id, uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_procurement_import_batches_brand_status
  ON public.procurement_import_batches (brand_id, status, uploaded_at DESC);

COMMENT ON TABLE public.procurement_import_batches IS
  'Upload sessions for B2B order imports that replace local JSON file storage.';

CREATE TABLE IF NOT EXISTS public.procurement_import_batch_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.procurement_import_batches(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.procurement_suppliers(id) ON DELETE RESTRICT,
  line_no INTEGER NOT NULL CHECK (line_no >= 1),
  merchant_order_no TEXT NOT NULL,
  customer_order_no TEXT,
  supplier_product_name TEXT NOT NULL,
  supplier_product_name_normalized TEXT NOT NULL,
  supplier_product_code TEXT,
  supplier_product_code_normalized TEXT,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_postcode TEXT,
  recipient_address TEXT NOT NULL,
  delivery_message TEXT,
  matched_supplier_item_id UUID REFERENCES public.procurement_supplier_items(id) ON DELETE SET NULL,
  matched_brand_product_id UUID REFERENCES public.brand_products(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'PENDING',
  price_source TEXT NOT NULL DEFAULT 'UNRESOLVED',
  unit_price_snapshot INTEGER CHECK (unit_price_snapshot IS NULL OR unit_price_snapshot >= 0),
  line_amount_snapshot INTEGER CHECK (line_amount_snapshot IS NULL OR line_amount_snapshot >= 0),
  source_row JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procurement_import_batch_lines_match_status_check
    CHECK (match_status IN ('PENDING', 'MATCHED', 'UNMATCHED', 'CONFLICT', 'SKIPPED')),
  CONSTRAINT procurement_import_batch_lines_price_source_check
    CHECK (price_source IN ('UNRESOLVED', 'SUPPLIER_ITEM', 'PRICE_HISTORY', 'FILE', 'MANUAL')),
  CONSTRAINT procurement_import_batch_lines_supplier_product_name_not_blank
    CHECK (length(btrim(supplier_product_name)) > 0),
  CONSTRAINT procurement_import_batch_lines_supplier_product_name_normalized_not_blank
    CHECK (length(btrim(supplier_product_name_normalized)) > 0),
  CONSTRAINT procurement_import_batch_lines_merchant_order_no_not_blank
    CHECK (length(btrim(merchant_order_no)) > 0),
  CONSTRAINT procurement_import_batch_lines_recipient_name_not_blank
    CHECK (length(btrim(recipient_name)) > 0),
  CONSTRAINT procurement_import_batch_lines_recipient_phone_not_blank
    CHECK (length(btrim(recipient_phone)) > 0),
  CONSTRAINT procurement_import_batch_lines_recipient_address_not_blank
    CHECK (length(btrim(recipient_address)) > 0),
  CONSTRAINT procurement_import_batch_lines_amount_consistency_check
    CHECK (
      line_amount_snapshot IS NULL
      OR unit_price_snapshot IS NULL
      OR line_amount_snapshot = unit_price_snapshot * quantity
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_import_batch_lines_batch_line_unique
  ON public.procurement_import_batch_lines (batch_id, line_no);

CREATE INDEX IF NOT EXISTS idx_procurement_import_batch_lines_batch_status
  ON public.procurement_import_batch_lines (batch_id, match_status, line_no);

CREATE INDEX IF NOT EXISTS idx_procurement_import_batch_lines_supplier_product
  ON public.procurement_import_batch_lines (supplier_id, supplier_product_name_normalized);

CREATE INDEX IF NOT EXISTS idx_procurement_import_batch_lines_matched_item
  ON public.procurement_import_batch_lines (matched_supplier_item_id, created_at DESC);

COMMENT ON TABLE public.procurement_import_batch_lines IS
  'Uploaded order rows with snapshot prices and supplier-to-internal item matching results.';

COMMENT ON COLUMN public.procurement_import_batch_lines.unit_price_snapshot IS
  'Price fixed at import time so later supplier price changes do not rewrite history.';

CREATE OR REPLACE FUNCTION public.procurement_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.procurement_validate_supplier_item_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.procurement_suppliers s
    JOIN public.brand_products bp
      ON bp.id = NEW.brand_product_id
    WHERE s.id = NEW.supplier_id
      AND s.brand_id = NEW.brand_id
      AND bp.brand_id = NEW.brand_id
  ) THEN
    RAISE EXCEPTION
      'procurement_supplier_items brand/supplier/product mismatch for supplier_item %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.procurement_validate_supplier_item_alias_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.procurement_supplier_items si
    WHERE si.id = NEW.supplier_item_id
      AND si.brand_id = NEW.brand_id
      AND si.supplier_id = NEW.supplier_id
  ) THEN
    RAISE EXCEPTION
      'procurement_supplier_item_aliases brand/supplier/item mismatch for alias %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.procurement_validate_price_history_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.procurement_supplier_items si
    WHERE si.id = NEW.supplier_item_id
      AND si.brand_id = NEW.brand_id
      AND si.supplier_id = NEW.supplier_id
  ) THEN
    RAISE EXCEPTION
      'procurement_price_history brand/supplier/item mismatch for history %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.procurement_validate_import_batch_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.procurement_suppliers s
    WHERE s.id = NEW.supplier_id
      AND s.brand_id = NEW.brand_id
  ) THEN
    RAISE EXCEPTION
      'procurement_import_batches brand/supplier mismatch for batch %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.procurement_validate_import_batch_line_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.procurement_import_batches b
    WHERE b.id = NEW.batch_id
      AND b.brand_id = NEW.brand_id
      AND b.supplier_id = NEW.supplier_id
  ) THEN
    RAISE EXCEPTION
      'procurement_import_batch_lines batch mismatch for line %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  IF NEW.matched_supplier_item_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.procurement_supplier_items si
       WHERE si.id = NEW.matched_supplier_item_id
         AND si.brand_id = NEW.brand_id
         AND si.supplier_id = NEW.supplier_id
     ) THEN
    RAISE EXCEPTION
      'procurement_import_batch_lines matched supplier item mismatch for line %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  IF NEW.matched_brand_product_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.brand_products bp
       WHERE bp.id = NEW.matched_brand_product_id
         AND bp.brand_id = NEW.brand_id
     ) THEN
    RAISE EXCEPTION
      'procurement_import_batch_lines matched brand product mismatch for line %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  IF NEW.matched_supplier_item_id IS NOT NULL
     AND NEW.matched_brand_product_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.procurement_supplier_items si
       WHERE si.id = NEW.matched_supplier_item_id
         AND si.brand_product_id = NEW.matched_brand_product_id
     ) THEN
    RAISE EXCEPTION
      'procurement_import_batch_lines matched item/product mismatch for line %',
      COALESCE(NEW.id::TEXT, '<new>');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_procurement_suppliers_updated_at
  ON public.procurement_suppliers;
CREATE TRIGGER trg_procurement_suppliers_updated_at
  BEFORE UPDATE ON public.procurement_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_set_updated_at();

DROP TRIGGER IF EXISTS trg_procurement_supplier_items_updated_at
  ON public.procurement_supplier_items;
CREATE TRIGGER trg_procurement_supplier_items_updated_at
  BEFORE UPDATE ON public.procurement_supplier_items
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_set_updated_at();

DROP TRIGGER IF EXISTS trg_procurement_supplier_item_aliases_updated_at
  ON public.procurement_supplier_item_aliases;
CREATE TRIGGER trg_procurement_supplier_item_aliases_updated_at
  BEFORE UPDATE ON public.procurement_supplier_item_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_set_updated_at();

DROP TRIGGER IF EXISTS trg_procurement_import_batches_updated_at
  ON public.procurement_import_batches;
CREATE TRIGGER trg_procurement_import_batches_updated_at
  BEFORE UPDATE ON public.procurement_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_set_updated_at();

DROP TRIGGER IF EXISTS trg_procurement_import_batch_lines_updated_at
  ON public.procurement_import_batch_lines;
CREATE TRIGGER trg_procurement_import_batch_lines_updated_at
  BEFORE UPDATE ON public.procurement_import_batch_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_set_updated_at();

DROP TRIGGER IF EXISTS trg_procurement_supplier_items_validate_refs
  ON public.procurement_supplier_items;
CREATE TRIGGER trg_procurement_supplier_items_validate_refs
  BEFORE INSERT OR UPDATE ON public.procurement_supplier_items
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_validate_supplier_item_refs();

DROP TRIGGER IF EXISTS trg_procurement_supplier_item_aliases_validate_refs
  ON public.procurement_supplier_item_aliases;
CREATE TRIGGER trg_procurement_supplier_item_aliases_validate_refs
  BEFORE INSERT OR UPDATE ON public.procurement_supplier_item_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_validate_supplier_item_alias_refs();

DROP TRIGGER IF EXISTS trg_procurement_price_history_validate_refs
  ON public.procurement_price_history;
CREATE TRIGGER trg_procurement_price_history_validate_refs
  BEFORE INSERT OR UPDATE ON public.procurement_price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_validate_price_history_refs();

DROP TRIGGER IF EXISTS trg_procurement_import_batches_validate_refs
  ON public.procurement_import_batches;
CREATE TRIGGER trg_procurement_import_batches_validate_refs
  BEFORE INSERT OR UPDATE ON public.procurement_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_validate_import_batch_refs();

DROP TRIGGER IF EXISTS trg_procurement_import_batch_lines_validate_refs
  ON public.procurement_import_batch_lines;
CREATE TRIGGER trg_procurement_import_batch_lines_validate_refs
  BEFORE INSERT OR UPDATE ON public.procurement_import_batch_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.procurement_validate_import_batch_line_refs();

ALTER TABLE IF EXISTS public.procurement_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_supplier_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_import_batch_lines ENABLE ROW LEVEL SECURITY;

COMMIT;
