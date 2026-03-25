-- Harden function search_path and remove permissive RLS policies that are not
-- needed when the backend uses the service role client.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_customer_stamps_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_stamp_card_configs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.earn_stamps(
  p_branch_id UUID,
  p_customer_phone VARCHAR(30),
  p_qty INT,
  p_order_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.customer_stamps (
    branch_id,
    customer_phone,
    total_earned,
    total_redeemed
  )
  VALUES (p_branch_id, p_customer_phone, p_qty, 0)
  ON CONFLICT (branch_id, customer_phone)
  DO UPDATE
    SET total_earned = public.customer_stamps.total_earned + p_qty;

  INSERT INTO public.stamp_transactions (
    branch_id,
    customer_phone,
    order_id,
    transaction_type,
    qty
  )
  VALUES (p_branch_id, p_customer_phone, p_order_id, 'EARN', p_qty);
END;
$$;

DROP POLICY IF EXISTS "System can insert inventory logs" ON public.inventory_logs;
DROP POLICY IF EXISTS "System can insert webhook logs" ON public.payment_webhook_logs;
DROP POLICY IF EXISTS "System can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.user_notifications;

COMMIT;
