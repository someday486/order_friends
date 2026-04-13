-- Phase 6: Payment Integration
-- Create tables for payment processing with Toss Payments / Stripe

-- ============================================================
-- 1. Payments Table
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  -- Payment details
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'KRW',

  -- Provider information
  provider VARCHAR(50) NOT NULL CHECK (provider IN ('TOSS', 'STRIPE', 'MANUAL')),
  provider_payment_id VARCHAR(255), -- External payment ID from provider
  provider_payment_key VARCHAR(255), -- Toss paymentKey or Stripe payment_intent_id

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING',      -- 결제 준비 중
    'SUCCESS',      -- 결제 성공
    'FAILED',       -- 결제 실패
    'CANCELLED',    -- 결제 취소
    'REFUNDED',     -- 환불 완료
    'PARTIAL_REFUNDED' -- 부분 환불
  )),

  -- Payment method details
  payment_method VARCHAR(50), -- CARD, VIRTUAL_ACCOUNT, TRANSFER, MOBILE
  payment_method_detail TEXT, -- JSON string with card info, account info, etc.

  -- Timestamps
  paid_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,

  -- Failure/cancellation reason
  failure_reason TEXT,
  cancellation_reason TEXT,

  -- Refund
  refund_amount INTEGER DEFAULT 0 CHECK (refund_amount >= 0),
  refund_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- ============================================================
-- 2. Payment Webhook Logs Table
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  -- Webhook details
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,

  -- Request data
  request_body JSONB,
  request_headers JSONB,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  -- Timestamps
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_payment ON payment_webhook_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_logs_processed ON payment_webhook_logs(processed, received_at);

-- ============================================================
-- 3. Enable Row Level Security
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies for payments
-- ============================================================

-- Admins can see all payments
CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

CREATE POLICY "Admins can manage all payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

-- Brand members can view payments for their brand's orders
CREATE POLICY "Brand members can view payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brand_members bm
      JOIN branches b ON b.brand_id = bm.brand_id
      JOIN orders o ON o.branch_id = b.id
      WHERE bm.user_id = auth.uid()
      AND o.id = payments.order_id
      AND bm.status = 'ACTIVE'
    )
  );

-- Branch members can view payments for their branch's orders
CREATE POLICY "Branch members can view payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branch_members brm
      JOIN orders o ON o.branch_id = brm.branch_id
      WHERE brm.user_id = auth.uid()
      AND o.id = payments.order_id
      AND brm.status = 'ACTIVE'
    )
  );

-- System can create/update payments (no user restriction for backend)
CREATE POLICY "System can manage payments"
  ON payments FOR ALL
  WITH CHECK (true);

-- ============================================================
-- 5. RLS Policies for payment_webhook_logs (admin only)
-- ============================================================

-- Admins can see all webhook logs
CREATE POLICY "Admins can view all webhook logs"
  ON payment_webhook_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = current_setting('app.admin_email', true)
    )
  );

-- System can insert webhook logs
CREATE POLICY "System can insert webhook logs"
  ON payment_webhook_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 6. Functions
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payments
CREATE TRIGGER update_payments_timestamp
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_updated_at();

-- ============================================================
-- 7. Function to update order payment status
-- ============================================================
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update order payment_status based on payment status
  IF NEW.status = 'SUCCESS' THEN
    UPDATE orders
    SET payment_status = 'PAID',
        status = CASE
          WHEN status = 'CREATED' THEN 'PENDING'
          ELSE status
        END
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'FAILED' THEN
    UPDATE orders
    SET payment_status = 'FAILED'
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'CANCELLED' THEN
    UPDATE orders
    SET payment_status = 'CANCELLED',
        status = 'CANCELLED'
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'REFUNDED' THEN
    UPDATE orders
    SET payment_status = 'REFUNDED',
        status = 'CANCELLED'
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update order when payment status changes
CREATE TRIGGER update_order_on_payment_status_change
  AFTER INSERT OR UPDATE OF status ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_order_payment_status();

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON TABLE payments IS 'Payment records for orders with provider integration';
COMMENT ON TABLE payment_webhook_logs IS 'Audit log of payment webhook events from providers';
COMMENT ON COLUMN payments.provider IS 'Payment provider: TOSS (Toss Payments), STRIPE, or MANUAL';
COMMENT ON COLUMN payments.status IS 'Payment status: PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED, PARTIAL_REFUNDED';
COMMENT ON COLUMN payments.provider_payment_key IS 'Toss paymentKey or Stripe payment_intent_id for API calls';
