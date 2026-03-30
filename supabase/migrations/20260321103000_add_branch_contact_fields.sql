-- Add public branch contact fields for customer support on public order pages.

BEGIN;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS kakao_channel_url TEXT;

COMMENT ON COLUMN public.branches.contact_phone IS
  'Public branch contact phone shown on order and order-tracking pages.';

COMMENT ON COLUMN public.branches.kakao_channel_url IS
  'Public KakaoTalk 상담 URL shown on order and order-tracking pages.';

COMMIT;
