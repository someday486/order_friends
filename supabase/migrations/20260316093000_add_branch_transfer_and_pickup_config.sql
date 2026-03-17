-- Add branch-level transfer account and pickup time configuration storage.

BEGIN;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS transfer_account JSONB,
  ADD COLUMN IF NOT EXISTS pickup_time_config JSONB;

COMMENT ON COLUMN public.branches.transfer_account IS
  'Branch transfer account config: {"bank_name":"...","account_number":"...","account_holder":"..."}';

COMMENT ON COLUMN public.branches.pickup_time_config IS
  'Branch pickup time config: {"start_time":"09:00","end_time":"21:00"}';

COMMIT;
