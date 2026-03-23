-- Enable RLS on internal tables exposed in the public schema.

BEGIN;

ALTER TABLE IF EXISTS public.customer_member_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customer_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.brand_product_urgent_discount_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stamp_card_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stamp_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.customer_member_activity_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "customer_member_activity_logs_select_brand_members" ON public.customer_member_activity_logs';
    EXECUTE 'DROP POLICY IF EXISTS "customer_member_activity_logs_select_branch_members" ON public.customer_member_activity_logs';

    EXECUTE $policy$
      CREATE POLICY "customer_member_activity_logs_select_brand_members"
      ON public.customer_member_activity_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.brand_members bm
          WHERE bm.brand_id = customer_member_activity_logs.brand_id
            AND bm.user_id = auth.uid()
            AND bm.status = 'ACTIVE'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "customer_member_activity_logs_select_branch_members"
      ON public.customer_member_activity_logs
      FOR SELECT
      USING (
        customer_member_activity_logs.branch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.branch_members brm
          WHERE brm.branch_id = customer_member_activity_logs.branch_id
            AND brm.user_id = auth.uid()
            AND brm.status = 'ACTIVE'
        )
      )
    $policy$;
  END IF;

  IF to_regclass('public.customer_stamps') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "customer_stamps_select_brand_members" ON public.customer_stamps';
    EXECUTE 'DROP POLICY IF EXISTS "customer_stamps_select_branch_members" ON public.customer_stamps';

    EXECUTE $policy$
      CREATE POLICY "customer_stamps_select_brand_members"
      ON public.customer_stamps
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branches b
          JOIN public.brand_members bm
            ON bm.brand_id = b.brand_id
          WHERE b.id = customer_stamps.branch_id
            AND bm.user_id = auth.uid()
            AND bm.status = 'ACTIVE'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "customer_stamps_select_branch_members"
      ON public.customer_stamps
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branch_members brm
          WHERE brm.branch_id = customer_stamps.branch_id
            AND brm.user_id = auth.uid()
            AND brm.status = 'ACTIVE'
        )
      )
    $policy$;
  END IF;

  IF to_regclass('public.brand_product_urgent_discount_histories') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "brand_product_urgent_discount_histories_select_brand_members" ON public.brand_product_urgent_discount_histories';
    EXECUTE 'DROP POLICY IF EXISTS "brand_product_urgent_discount_histories_select_branch_members" ON public.brand_product_urgent_discount_histories';

    EXECUTE $policy$
      CREATE POLICY "brand_product_urgent_discount_histories_select_brand_members"
      ON public.brand_product_urgent_discount_histories
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.brand_members bm
          WHERE bm.brand_id = brand_product_urgent_discount_histories.brand_id
            AND bm.user_id = auth.uid()
            AND bm.status = 'ACTIVE'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "brand_product_urgent_discount_histories_select_branch_members"
      ON public.brand_product_urgent_discount_histories
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branches b
          JOIN public.branch_members brm
            ON brm.branch_id = b.id
          WHERE b.brand_id = brand_product_urgent_discount_histories.brand_id
            AND brm.user_id = auth.uid()
            AND brm.status = 'ACTIVE'
        )
      )
    $policy$;
  END IF;

  IF to_regclass('public.stamp_card_configs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "stamp_card_configs_select_brand_members" ON public.stamp_card_configs';
    EXECUTE 'DROP POLICY IF EXISTS "stamp_card_configs_select_branch_members" ON public.stamp_card_configs';

    EXECUTE $policy$
      CREATE POLICY "stamp_card_configs_select_brand_members"
      ON public.stamp_card_configs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branches b
          JOIN public.brand_members bm
            ON bm.brand_id = b.brand_id
          WHERE b.id = stamp_card_configs.branch_id
            AND bm.user_id = auth.uid()
            AND bm.status = 'ACTIVE'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "stamp_card_configs_select_branch_members"
      ON public.stamp_card_configs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branch_members brm
          WHERE brm.branch_id = stamp_card_configs.branch_id
            AND brm.user_id = auth.uid()
            AND brm.status = 'ACTIVE'
        )
      )
    $policy$;
  END IF;

  IF to_regclass('public.stamp_transactions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "stamp_transactions_select_brand_members" ON public.stamp_transactions';
    EXECUTE 'DROP POLICY IF EXISTS "stamp_transactions_select_branch_members" ON public.stamp_transactions';

    EXECUTE $policy$
      CREATE POLICY "stamp_transactions_select_brand_members"
      ON public.stamp_transactions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branches b
          JOIN public.brand_members bm
            ON bm.brand_id = b.brand_id
          WHERE b.id = stamp_transactions.branch_id
            AND bm.user_id = auth.uid()
            AND bm.status = 'ACTIVE'
        )
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "stamp_transactions_select_branch_members"
      ON public.stamp_transactions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.branch_members brm
          WHERE brm.branch_id = stamp_transactions.branch_id
            AND brm.user_id = auth.uid()
            AND brm.status = 'ACTIVE'
        )
      )
    $policy$;
  END IF;
END
$$;

COMMIT;
