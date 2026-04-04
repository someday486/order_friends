-- Enable RLS on internal financial tables exposed in the public schema.

BEGIN;

ALTER TABLE IF EXISTS public.deposit_match_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cash_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.deposit_match_rows') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "deposit_match_rows_select_members" ON public.deposit_match_rows';

    EXECUTE $policy$
      CREATE POLICY "deposit_match_rows_select_members"
      ON public.deposit_match_rows
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_system_admin = true
        )
        OR (
          deposit_match_rows.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.branch_members brm
            WHERE brm.branch_id = deposit_match_rows.branch_id
              AND brm.user_id = auth.uid()
              AND brm.status = 'ACTIVE'
          )
        )
        OR (
          deposit_match_rows.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.branches b
            JOIN public.brand_members bm
              ON bm.brand_id = b.brand_id
            WHERE b.id = deposit_match_rows.branch_id
              AND bm.user_id = auth.uid()
              AND bm.status = 'ACTIVE'
          )
        )
      )
    $policy$;
  END IF;

  IF to_regclass('public.cash_receipts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "cash_receipts_select_members" ON public.cash_receipts';

    EXECUTE $policy$
      CREATE POLICY "cash_receipts_select_members"
      ON public.cash_receipts
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
          FROM public.brand_members bm
          WHERE bm.brand_id = cash_receipts.brand_id
            AND bm.user_id = auth.uid()
            AND bm.status = 'ACTIVE'
        )
        OR (
          cash_receipts.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.branch_members brm
            WHERE brm.branch_id = cash_receipts.branch_id
              AND brm.user_id = auth.uid()
              AND brm.status = 'ACTIVE'
          )
        )
      )
    $policy$;
  END IF;
END
$$;

COMMIT;
