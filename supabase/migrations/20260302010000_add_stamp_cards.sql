-- ============================================================
-- Digital Stamp Card System
-- ============================================================

-- Branch-level stamp card configuration
CREATE TABLE IF NOT EXISTS stamp_card_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id           UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  is_active           BOOLEAN NOT NULL DEFAULT false,
  stamps_per_order    INT NOT NULL DEFAULT 1 CHECK (stamps_per_order >= 1 AND stamps_per_order <= 10),
  reward_threshold    INT NOT NULL DEFAULT 10 CHECK (reward_threshold >= 2 AND reward_threshold <= 100),
  reward_description  TEXT NOT NULL DEFAULT '스탬프 적립 완료 보상',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id)
);

-- Customer stamp balances per branch
CREATE TABLE IF NOT EXISTS customer_stamps (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_phone    VARCHAR(30) NOT NULL,
  total_earned      INT NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_redeemed    INT NOT NULL DEFAULT 0 CHECK (total_redeemed >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, customer_phone)
);

-- Individual stamp transactions (earn / redeem)
CREATE TABLE IF NOT EXISTS stamp_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_phone    VARCHAR(30) NOT NULL,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type  VARCHAR(10) NOT NULL CHECK (transaction_type IN ('EARN', 'REDEEM')),
  qty               INT NOT NULL CHECK (qty > 0),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stamp_transactions_branch_phone
  ON stamp_transactions (branch_id, customer_phone);

CREATE INDEX IF NOT EXISTS idx_customer_stamps_phone
  ON customer_stamps (customer_phone);

-- Auto-update updated_at on customer_stamps
CREATE OR REPLACE FUNCTION update_customer_stamps_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customer_stamps_updated_at
  BEFORE UPDATE ON customer_stamps
  FOR EACH ROW EXECUTE FUNCTION update_customer_stamps_updated_at();

CREATE OR REPLACE FUNCTION update_stamp_card_configs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_card_configs_updated_at
  BEFORE UPDATE ON stamp_card_configs
  FOR EACH ROW EXECUTE FUNCTION update_stamp_card_configs_updated_at();

-- RPC: atomically earn stamps and log transaction
CREATE OR REPLACE FUNCTION earn_stamps(
  p_branch_id      UUID,
  p_customer_phone VARCHAR(30),
  p_qty            INT,
  p_order_id       UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO customer_stamps (branch_id, customer_phone, total_earned, total_redeemed)
  VALUES (p_branch_id, p_customer_phone, p_qty, 0)
  ON CONFLICT (branch_id, customer_phone)
  DO UPDATE SET total_earned = customer_stamps.total_earned + p_qty;

  INSERT INTO stamp_transactions (branch_id, customer_phone, order_id, transaction_type, qty)
  VALUES (p_branch_id, p_customer_phone, p_order_id, 'EARN', p_qty);
END;
$$;
