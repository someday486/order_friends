ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS cash_receipt_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_receipt_provider varchar(50),
  ADD COLUMN IF NOT EXISTS cash_receipt_merchant_id varchar(100),
  ADD COLUMN IF NOT EXISTS cash_receipt_issue_timing varchar(30) DEFAULT 'ORDER_COMPLETED',
  ADD COLUMN IF NOT EXISTS cash_receipt_self_issue_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_receipt_contact_name varchar(100),
  ADD COLUMN IF NOT EXISTS cash_receipt_contact_phone varchar(30);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cash_receipt_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_receipt_type varchar(30),
  ADD COLUMN IF NOT EXISTS cash_receipt_identity_type varchar(30),
  ADD COLUMN IF NOT EXISTS cash_receipt_identity_value text;

CREATE TABLE IF NOT EXISTS cash_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  provider varchar(50) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'REQUESTED',
  issue_type varchar(30) NOT NULL,
  identity_type varchar(30) NOT NULL,
  identity_value_masked varchar(100),
  identity_value_encrypted text,
  receipt_key varchar(120),
  approval_no varchar(120),
  issued_at timestamptz,
  cancelled_at timestamptz,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code varchar(100),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cash_receipts_order_active_unique
  ON cash_receipts(order_id)
  WHERE status IN ('REQUESTED', 'ISSUED', 'CANCEL_REQUESTED');

CREATE INDEX IF NOT EXISTS cash_receipts_brand_created_idx
  ON cash_receipts(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cash_receipts_order_created_idx
  ON cash_receipts(order_id, created_at DESC);
