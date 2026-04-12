BEGIN;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS delivery_carrier TEXT,
  ADD COLUMN IF NOT EXISTS delivery_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_status_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.delivery_status IS
  'Read-only delivery tracking status for DELIVERY/SHIPPING orders.';
COMMENT ON COLUMN public.orders.delivery_carrier IS
  'Carrier label used for delivery tracking display.';
COMMENT ON COLUMN public.orders.delivery_tracking_number IS
  'Carrier tracking number for delivery orders.';
COMMENT ON COLUMN public.orders.delivery_started_at IS
  'Timestamp when delivery moved into transit.';
COMMENT ON COLUMN public.orders.delivered_at IS
  'Timestamp when delivery was confirmed as delivered.';
COMMENT ON COLUMN public.orders.delivery_status_updated_at IS
  'Latest timestamp when delivery tracking status changed.';

COMMIT;
