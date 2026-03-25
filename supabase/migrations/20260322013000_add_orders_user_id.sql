-- Store the authenticated purchaser on orders for buyer self-service actions.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);

COMMENT ON COLUMN public.orders.user_id IS
  'Authenticated Supabase user who placed the order.';

COMMIT;
