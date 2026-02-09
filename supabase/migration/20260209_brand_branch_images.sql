-- ============================================================
-- brands/branches 이미지 컬럼 추가
-- logo_url: 브랜드/가게 로고 이미지
-- cover_image_url: 커버/배너 이미지
-- thumbnail_url: 목록용 썸네일 이미지
-- ============================================================

-- brands 테이블
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- branches 테이블
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
