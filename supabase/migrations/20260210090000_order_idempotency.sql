-- 2026-02-10: Order/payment idempotency + dedup logs + atomic inventory reservation

-- ============================================================
-- 1. Idempotency columns & unique indexes
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_branch_idempotency_key
  ON orders(branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
  ON payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_payment_key
  ON payments(provider, provider_payment_key)
  WHERE provider_payment_key IS NOT NULL;

-- ============================================================
-- 2. Order duplicate detection logs
-- ============================================================
CREATE TABLE IF NOT EXISTS order_dedup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  matched_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  signature TEXT,
  total_amount INTEGER,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address1 TEXT,
  payment_method TEXT,
  strategy TEXT,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_dedup_logs_branch
  ON order_dedup_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_dedup_logs_idempotency_key
  ON order_dedup_logs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_order_dedup_logs_matched_order
  ON order_dedup_logs(matched_order_id);

ALTER TABLE order_dedup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all order_dedup_logs"
  ON order_dedup_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

CREATE POLICY "System can insert order_dedup_logs"
  ON order_dedup_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 3. Atomic inventory reservation function
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_inventory_for_order(
  branch_id UUID,
  order_id UUID,
  order_no TEXT,
  items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_inventory RECORD;
  v_after INTEGER;
BEGIN
  IF items IS NULL OR jsonb_typeof(items) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ITEMS';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(items) LOOP
    v_product_id := NULLIF(item->>'product_id', '')::uuid;
    v_qty := COALESCE(NULLIF(item->>'qty', '')::int, 0);

    IF v_product_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_ITEM';
    END IF;

    SELECT * INTO v_inventory
    FROM product_inventory
    WHERE product_id = v_product_id
      AND branch_id = reserve_inventory_for_order.branch_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVENTORY_NOT_FOUND:%', v_product_id;
    END IF;

    IF v_inventory.qty_available < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_INVENTORY:%', v_product_id;
    END IF;

    v_after := v_inventory.qty_available - v_qty;

    UPDATE product_inventory
    SET qty_available = v_after,
        qty_reserved = v_inventory.qty_reserved + v_qty
    WHERE product_id = v_product_id
      AND branch_id = reserve_inventory_for_order.branch_id;

    INSERT INTO inventory_logs (
      product_id,
      branch_id,
      transaction_type,
      qty_change,
      qty_before,
      qty_after,
      reference_id,
      reference_type,
      notes
    ) VALUES (
      v_product_id,
      reserve_inventory_for_order.branch_id,
      'RESERVE',
      -v_qty,
      v_inventory.qty_available,
      v_after,
      reserve_inventory_for_order.order_id,
      'ORDER',
      '주문 생성으로 인한 재고 예약 (주문번호: ' || COALESCE(reserve_inventory_for_order.order_no, '-') || ')'
    );
  END LOOP;
END;
$$;

COMMENT ON TABLE order_dedup_logs IS 'Audit log for detected duplicate public orders';
COMMENT ON COLUMN orders.idempotency_key IS 'Client-provided idempotency key for safe retries';
COMMENT ON COLUMN payments.idempotency_key IS 'Client-provided idempotency key for payment confirmation';
COMMENT ON FUNCTION reserve_inventory_for_order IS 'Atomically reserve inventory and log changes for an order';
