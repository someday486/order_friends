BEGIN;

CREATE OR REPLACE FUNCTION public.update_order_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
        status = CASE
          WHEN status IN ('COMPLETED', 'REFUNDED') THEN 'REFUNDED'::public.order_status
          ELSE 'CANCELLED'::public.order_status
        END
    WHERE id = NEW.order_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
