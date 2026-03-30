BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'payment_status'
  ) THEN
    CREATE TYPE public.payment_status AS ENUM (
      'PENDING',
      'PAID',
      'FAILED',
      'CANCELLED',
      'REFUNDED'
    );
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status;

ALTER TABLE public.orders
  ALTER COLUMN payment_status SET DEFAULT 'PENDING';

UPDATE public.orders
SET payment_status = CASE
  WHEN status = 'CANCELLED' THEN 'CANCELLED'::public.payment_status
  WHEN status = 'REFUNDED' THEN 'REFUNDED'::public.payment_status
  WHEN status IN ('CONFIRMED', 'PREPARING', 'READY', 'COMPLETED') THEN 'PAID'::public.payment_status
  ELSE 'PENDING'::public.payment_status
END
WHERE payment_status IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN payment_status SET NOT NULL;

CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUCCESS' THEN
    UPDATE public.orders
    SET payment_status = 'PAID',
        status = CASE
          WHEN status = 'CREATED' THEN 'CONFIRMED'::public.order_status
          ELSE status
        END
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'FAILED' THEN
    UPDATE public.orders
    SET payment_status = 'FAILED'
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'CANCELLED' THEN
    UPDATE public.orders
    SET payment_status = 'CANCELLED',
        status = 'CANCELLED'
    WHERE id = NEW.order_id;
  ELSIF NEW.status = 'REFUNDED' THEN
    UPDATE public.orders
    SET payment_status = 'REFUNDED',
        status = 'CANCELLED'
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_order_on_payment_status_change ON public.payments;

CREATE TRIGGER update_order_on_payment_status_change
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_payment_status();

COMMIT;
