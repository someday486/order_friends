BEGIN;

ALTER TABLE IF EXISTS public.brand_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_supplier_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.procurement_import_batch_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_products_select_members ON public.brand_products;
CREATE POLICY brand_products_select_members
  ON public.brand_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = brand_products.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = brand_products.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1
      FROM public.branches br
      JOIN public.branch_members brm
        ON brm.branch_id = br.id
       AND brm.user_id = auth.uid()
       AND brm.status = 'ACTIVE'
      WHERE br.brand_id = brand_products.brand_id
    )
  );

DROP POLICY IF EXISTS order_channels_select_members ON public.order_channels;
CREATE POLICY order_channels_select_members
  ON public.order_channels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.branch_members brm
      WHERE brm.branch_id = order_channels.branch_id
        AND brm.user_id = auth.uid()
        AND brm.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1
      FROM public.branches br
      JOIN public.brands b
        ON b.id = br.brand_id
      WHERE br.id = order_channels.branch_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.branches br
      JOIN public.brand_members bm
        ON bm.brand_id = br.brand_id
       AND bm.user_id = auth.uid()
       AND bm.status = 'ACTIVE'
      WHERE br.id = order_channels.branch_id
    )
  );

DROP POLICY IF EXISTS procurement_suppliers_select_members
  ON public.procurement_suppliers;
CREATE POLICY procurement_suppliers_select_members
  ON public.procurement_suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = procurement_suppliers.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = procurement_suppliers.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS procurement_supplier_items_select_members
  ON public.procurement_supplier_items;
CREATE POLICY procurement_supplier_items_select_members
  ON public.procurement_supplier_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = procurement_supplier_items.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = procurement_supplier_items.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS procurement_supplier_item_aliases_select_members
  ON public.procurement_supplier_item_aliases;
CREATE POLICY procurement_supplier_item_aliases_select_members
  ON public.procurement_supplier_item_aliases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = procurement_supplier_item_aliases.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = procurement_supplier_item_aliases.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS procurement_price_history_select_members
  ON public.procurement_price_history;
CREATE POLICY procurement_price_history_select_members
  ON public.procurement_price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = procurement_price_history.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = procurement_price_history.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS procurement_import_batches_select_members
  ON public.procurement_import_batches;
CREATE POLICY procurement_import_batches_select_members
  ON public.procurement_import_batches
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = procurement_import_batches.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = procurement_import_batches.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS procurement_import_batch_lines_select_members
  ON public.procurement_import_batch_lines;
CREATE POLICY procurement_import_batch_lines_select_members
  ON public.procurement_import_batch_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_system_admin = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.brands b
      WHERE b.id = procurement_import_batch_lines.brand_id
        AND b.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.brand_members bm
      WHERE bm.brand_id = procurement_import_batch_lines.brand_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'ACTIVE'
    )
  );

COMMIT;
