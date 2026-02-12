-- Phase 5: Inventory Management System
-- Create tables for inventory tracking and management

-- ============================================================
-- 1. Product Inventory Table
-- ============================================================
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  -- Inventory quantities
  qty_available INTEGER NOT NULL DEFAULT 0 CHECK (qty_available >= 0),
  qty_reserved INTEGER NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  qty_sold INTEGER NOT NULL DEFAULT 0 CHECK (qty_sold >= 0),

  -- Alerts
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(product_id, branch_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_inventory_product ON product_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_branch ON product_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_low_stock ON product_inventory(branch_id)
  WHERE qty_available <= low_stock_threshold;

-- ============================================================
-- 2. Inventory Transaction Logs Table
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'RESTOCK',      -- 입고
    'SALE',         -- 판매
    'RESERVE',      -- 예약 (주문 생성)
    'RELEASE',      -- 예약 해제 (주문 취소)
    'ADJUSTMENT',   -- 수동 조정
    'DAMAGE',       -- 파손/폐기
    'RETURN'        -- 반품
  )),

  qty_change INTEGER NOT NULL, -- Positive or negative
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,

  -- Reference
  reference_id UUID, -- order_id or adjustment_id
  reference_type VARCHAR(50), -- 'ORDER', 'ADJUSTMENT', etc.

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_branch ON inventory_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_reference ON inventory_logs(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at DESC);

-- ============================================================
-- 3. Enable Row Level Security
-- ============================================================
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies for product_inventory
-- ============================================================

-- Admins can see everything
CREATE POLICY "Admins can view all inventory"
  ON product_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

CREATE POLICY "Admins can manage all inventory"
  ON product_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

-- Brand members can view inventory for their brand's branches
CREATE POLICY "Brand members can view inventory"
  ON product_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brand_members bm
      JOIN branches b ON b.brand_id = bm.brand_id
      WHERE bm.user_id = auth.uid()
      AND b.id = product_inventory.branch_id
      AND bm.status = 'ACTIVE'
    )
  );

-- Branch members can view inventory for their branch
CREATE POLICY "Branch members can view inventory"
  ON product_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branch_members brm
      WHERE brm.user_id = auth.uid()
      AND brm.branch_id = product_inventory.branch_id
      AND brm.status = 'ACTIVE'
    )
  );

-- Only BRANCH_OWNER/BRANCH_ADMIN or brand OWNER/ADMIN can modify inventory
CREATE POLICY "OWNER/ADMIN can modify inventory"
  ON product_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM branch_members brm
      WHERE brm.user_id = auth.uid()
      AND brm.branch_id = product_inventory.branch_id
      AND brm.role IN ('BRANCH_OWNER', 'BRANCH_ADMIN')
      AND brm.status = 'ACTIVE'
    )
    OR
    EXISTS (
      SELECT 1 FROM brand_members bm
      JOIN branches b ON b.brand_id = bm.brand_id
      WHERE bm.user_id = auth.uid()
      AND b.id = product_inventory.branch_id
      AND bm.role IN ('OWNER', 'ADMIN')
      AND bm.status = 'ACTIVE'
    )
  );

-- ============================================================
-- 5. RLS Policies for inventory_logs (read-only for most users)
-- ============================================================

-- Admins can see all logs
CREATE POLICY "Admins can view all inventory logs"
  ON inventory_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

-- Brand members can view logs for their brand's branches
CREATE POLICY "Brand members can view inventory logs"
  ON inventory_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brand_members bm
      JOIN branches b ON b.brand_id = bm.brand_id
      WHERE bm.user_id = auth.uid()
      AND b.id = inventory_logs.branch_id
      AND bm.status = 'ACTIVE'
    )
  );

-- Branch members can view logs for their branch
CREATE POLICY "Branch members can view inventory logs"
  ON inventory_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branch_members brm
      WHERE brm.user_id = auth.uid()
      AND brm.branch_id = inventory_logs.branch_id
      AND brm.status = 'ACTIVE'
    )
  );

-- System can insert logs (no user restriction for inserts via backend)
CREATE POLICY "System can insert inventory logs"
  ON inventory_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 6. Functions
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for product_inventory
CREATE TRIGGER update_product_inventory_timestamp
  BEFORE UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_updated_at();

-- ============================================================
-- 7. Initial Data
-- ============================================================

-- Create initial inventory records for existing products
-- (This will be run once, then can be removed)
INSERT INTO product_inventory (product_id, branch_id, qty_available, low_stock_threshold)
SELECT
  p.id as product_id,
  p.branch_id,
  100 as qty_available, -- Default starting stock
  10 as low_stock_threshold
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM product_inventory pi
  WHERE pi.product_id = p.id AND pi.branch_id = p.branch_id
)
ON CONFLICT (product_id, branch_id) DO NOTHING;

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON TABLE product_inventory IS 'Tracks real-time inventory for each product at each branch';
COMMENT ON TABLE inventory_logs IS 'Audit log of all inventory changes';
COMMENT ON COLUMN product_inventory.qty_available IS 'Current available quantity for sale';
COMMENT ON COLUMN product_inventory.qty_reserved IS 'Quantity reserved by pending orders (not yet paid)';
COMMENT ON COLUMN product_inventory.qty_sold IS 'Total quantity sold (historical)';
COMMENT ON COLUMN inventory_logs.transaction_type IS 'Type of inventory change: RESTOCK, SALE, RESERVE, RELEASE, ADJUSTMENT, DAMAGE, RETURN';
