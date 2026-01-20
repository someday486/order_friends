begin;

-- UUID 생성 함수용 (Supabase는 보통 이미 깔려있지만 안전하게)
create extension if not exists "pgcrypto";

-- 1) PROFILES
-- Supabase Auth 유저 테이블은 auth.users 입니다.
-- profiles.id를 auth.users.id와 1:1로 맞추는 패턴(권장)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- 2) BRANDS
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid, -- (선택) profiles.id를 참조하도록 강화 가능
  biz_name text,
  biz_reg_no text,
  created_at timestamptz not null default now()
);

-- owner_user_id FK는 일단 느슨하게 두고, 운영 정책 확정 후 FK 추가 권장
-- 원하면 아래 주석 해제하여 FK 강제 가능(단, 데이터 정합성 필요)
-- alter table public.brands
--   add constraint brands_owner_user_id_fk
--   foreign key (owner_user_id) references public.profiles(id);

-- 3) BRANCHES
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- 4) BRAND_MEMBERS
-- role/status 타입은 다음 migration에서 enum으로 바꿀 것이므로
-- 여기서는 text로 먼저 만들어 둡니다.
create table if not exists public.brand_members (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

-- 5) BRANCH_MEMBERS
create table if not exists public.branch_members (
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'STAFF',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

commit;
