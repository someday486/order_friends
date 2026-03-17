-- Add branch-level order notice text shown on the public order page.

BEGIN;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS order_notice TEXT;

COMMENT ON COLUMN public.branches.order_notice IS
  'Branch order notice shown above the public menu/order page.';

COMMIT;
