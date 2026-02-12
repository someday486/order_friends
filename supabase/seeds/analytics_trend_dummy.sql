-- ============================================================================
-- Analytics Trend Dummy Data (for chart readability tests)
-- ----------------------------------------------------------------------------
-- Creates many orders/order_items across multiple branches and days
-- so "일별 매출 추이", "ABC 분석" 등 차트 테스트가 쉬워집니다.
--
-- Safe to re-run:
-- - Removes previously inserted rows where customer_name starts with 'Trend Dummy'
-- ============================================================================

-- Performance safety net for analytics queries (idempotent)
CREATE INDEX IF NOT EXISTS idx_orders_brand_created_status
ON public.orders (brand_id, created_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON public.order_items (order_id);

DO $$
DECLARE
  v_dummy_prefix text := 'Trend Dummy';
  v_start_date date := current_date - 179; -- last 180 days
  v_end_date date := current_date;
  v_orders_count integer := 0;
BEGIN
  -- Seed prerequisite check (same IDs used in supabase/seed.sql)
  IF NOT EXISTS (
    SELECT 1
    FROM public.order_channels
    WHERE id IN (
      '30000000-0000-0000-0000-000000000001'::uuid,
      '30000000-0000-0000-0000-000000000002'::uuid,
      '30000000-0000-0000-0000-000000000003'::uuid,
      '30000000-0000-0000-0000-000000000004'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'order_channels seed data not found. Run supabase/seed.sql first.';
  END IF;

  -- Re-runnable cleanup
  DELETE FROM public.order_items
  WHERE order_id IN (
    SELECT id
    FROM public.orders
    WHERE customer_name LIKE v_dummy_prefix || '%'
  );

  DELETE FROM public.orders
  WHERE customer_name LIKE v_dummy_prefix || '%';

  -- 1) Bulk create orders with day/hour variation
  INSERT INTO public.orders (
    branch_id,
    channel_id,
    fulfillment_type,
    customer_name,
    customer_phone,
    created_at
  )
  SELECT
    b.branch_id,
    b.channel_id,
    b.fulfillment_type,
    format(
      '%s %s %s-%s',
      v_dummy_prefix,
      b.branch_label,
      to_char(d.day_at, 'YYYYMMDD'),
      lpad(seq.n::text, 2, '0')
    ),
    '010-9000-0000',
    d.day_at
      + make_interval(
          hours => (8 + floor(random() * 14)::int), -- 08:00~21:59
          mins => floor(random() * 60)::int,
          secs => floor(random() * 60)::int
        )
  FROM (
    VALUES
      (
        '20000000-0000-0000-0000-000000000001'::uuid,
        '30000000-0000-0000-0000-000000000001'::uuid,
        'PICKUP'::public.fulfillment_type,
        'Gangnam'
      ),
      (
        '20000000-0000-0000-0000-000000000002'::uuid,
        '30000000-0000-0000-0000-000000000002'::uuid,
        'PICKUP'::public.fulfillment_type,
        'Hongdae'
      ),
      (
        '20000000-0000-0000-0000-000000000003'::uuid,
        '30000000-0000-0000-0000-000000000003'::uuid,
        'PICKUP'::public.fulfillment_type,
        'Restaurant'
      ),
      (
        '20000000-0000-0000-0000-000000000004'::uuid,
        '30000000-0000-0000-0000-000000000004'::uuid,
        'DELIVERY'::public.fulfillment_type,
        'Bakery'
      )
  ) AS b(branch_id, channel_id, fulfillment_type, branch_label)
  CROSS JOIN LATERAL generate_series(v_start_date, v_end_date, interval '1 day') AS d(day_at)
  CROSS JOIN LATERAL (
    SELECT (
      CASE
        WHEN extract(isodow FROM d.day_at) IN (5, 6) THEN 10 -- Fri/Sat peak
        WHEN extract(isodow FROM d.day_at) = 7 THEN 8         -- Sun
        ELSE 5                                                -- Weekday
      END
      + floor(random() * 5)::int
    ) AS order_count
  ) AS cnt
  CROSS JOIN LATERAL generate_series(1, cnt.order_count) AS seq(n);

  GET DIAGNOSTICS v_orders_count = ROW_COUNT;

  -- 2) Add random order items per order (1~3 kinds, qty 1~2)
  INSERT INTO public.order_items (
    order_id,
    product_id,
    product_name_snapshot,
    unit_price_snapshot,
    qty,
    line_total
  )
  SELECT
    o.id,
    p.id,
    p.name,
    p.base_price,
    q.qty,
    p.base_price * q.qty
  FROM public.orders o
  CROSS JOIN LATERAL (
    SELECT (1 + floor(random() * 3)::int) AS item_count
  ) AS c
  CROSS JOIN LATERAL (
    SELECT id, name, base_price
    FROM public.products
    WHERE branch_id = o.branch_id
    ORDER BY random()
    LIMIT c.item_count
  ) AS p
  CROSS JOIN LATERAL (
    SELECT (1 + floor(random() * 2)::int) AS qty
  ) AS q
  WHERE o.customer_name LIKE v_dummy_prefix || '%';

  -- 3) Recalculate order totals (supports both subtotal/subtotal_amount schemas)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'subtotal'
  ) THEN
    UPDATE public.orders o
    SET
      subtotal = t.total,
      total_amount = t.total
    FROM (
      SELECT oi.order_id, SUM(oi.line_total)::int AS total
      FROM public.order_items oi
      JOIN public.orders oo ON oo.id = oi.order_id
      WHERE oo.customer_name LIKE v_dummy_prefix || '%'
      GROUP BY oi.order_id
    ) AS t
    WHERE o.id = t.order_id;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'subtotal_amount'
  ) THEN
    UPDATE public.orders o
    SET
      subtotal_amount = t.total,
      total_amount = t.total
    FROM (
      SELECT oi.order_id, SUM(oi.line_total)::int AS total
      FROM public.order_items oi
      JOIN public.orders oo ON oo.id = oi.order_id
      WHERE oo.customer_name LIKE v_dummy_prefix || '%'
      GROUP BY oi.order_id
    ) AS t
    WHERE o.id = t.order_id;
  ELSE
    UPDATE public.orders o
    SET total_amount = t.total
    FROM (
      SELECT oi.order_id, SUM(oi.line_total)::int AS total
      FROM public.order_items oi
      JOIN public.orders oo ON oo.id = oi.order_id
      WHERE oo.customer_name LIKE v_dummy_prefix || '%'
      GROUP BY oi.order_id
    ) AS t
    WHERE o.id = t.order_id;
  END IF;

  -- 4) Status distribution for realistic analytics
  UPDATE public.orders
  SET status = 'CANCELLED'
  WHERE customer_name LIKE v_dummy_prefix || '%'
    AND status = 'CREATED'
    AND (abs(hashtext(id::text)) % 100) >= 95;

  UPDATE public.orders
  SET status = 'CONFIRMED'
  WHERE customer_name LIKE v_dummy_prefix || '%'
    AND status = 'CREATED'
    AND (abs(hashtext(id::text)) % 100) < 95;

  UPDATE public.orders
  SET status = 'PREPARING'
  WHERE customer_name LIKE v_dummy_prefix || '%'
    AND status = 'CONFIRMED'
    AND (abs(hashtext(id::text)) % 100) < 85;

  UPDATE public.orders
  SET status = 'READY'
  WHERE customer_name LIKE v_dummy_prefix || '%'
    AND status = 'PREPARING'
    AND (abs(hashtext(id::text)) % 100) < 75;

  UPDATE public.orders
  SET status = 'COMPLETED'
  WHERE customer_name LIKE v_dummy_prefix || '%'
    AND status = 'READY'
    AND (abs(hashtext(id::text)) % 100) < 60;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'completed_at'
  ) THEN
    UPDATE public.orders
    SET completed_at = created_at + interval '30 minutes'
    WHERE customer_name LIKE v_dummy_prefix || '%'
      AND status = 'COMPLETED'
      AND completed_at IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'cancelled_at'
  ) THEN
    UPDATE public.orders
    SET cancelled_at = created_at + interval '15 minutes'
    WHERE customer_name LIKE v_dummy_prefix || '%'
      AND status = 'CANCELLED'
      AND cancelled_at IS NULL;
  END IF;

  RAISE NOTICE 'Analytics trend dummy data inserted. orders=%', v_orders_count;
END $$;

-- Quick verification
SELECT
  status,
  COUNT(*) AS order_count,
  COALESCE(SUM(total_amount), 0) AS total_revenue
FROM public.orders
WHERE customer_name LIKE 'Trend Dummy%'
GROUP BY status
ORDER BY status;
