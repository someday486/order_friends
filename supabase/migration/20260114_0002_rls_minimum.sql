begin;

-- Helper: current user id
-- Supabase에서는 auth.uid() 사용 가능

-- ================
-- PROFILES
-- ================
alter table public.profiles enable row level security;

-- 본인 프로필만 조회/수정
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- (선택) 본인 프로필 insert 허용 (프로필을 앱에서 직접 만들 경우)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

-- ================
-- BRANDS
-- ================
alter table public.brands enable row level security;

-- brand_members ACTIVE인 brand만 읽기 허용
drop policy if exists "brands_select_member" on public.brands;
create policy "brands_select_member"
on public.brands
for select
to authenticated
using (
  exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = brands.id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'::public.member_status
  )
);

-- (MVP) brands 변경은 서버 전담을 권장하므로, update/insert/delete는 기본 차단 유지
-- 필요 시 서버 role(서비스키)에서만 수행하도록 설계

-- ================
-- BRANCHES
-- ================
alter table public.branches enable row level security;

-- Branch는 "해당 brand의 ACTIVE member"면 읽기 가능
drop policy if exists "branches_select_brand_member" on public.branches;
create policy "branches_select_brand_member"
on public.branches
for select
to authenticated
using (
  exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = branches.brand_id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'::public.member_status
  )
);

-- ================
-- BRAND_MEMBERS
-- ================
alter table public.brand_members enable row level security;

-- 본인이 속한 brand의 멤버십은 읽기 가능(운영상 필요)
drop policy if exists "brand_members_select_brand_member" on public.brand_members;
create policy "brand_members_select_brand_member"
on public.brand_members
for select
to authenticated
using (
  exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = brand_members.brand_id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'::public.member_status
  )
);

-- (MVP) 멤버 관리(insert/update/delete)는 서버 전담 권장: 기본 차단

-- ================
-- BRANCH_MEMBERS
-- ================
alter table public.branch_members enable row level security;

-- 본인이 속한 brand의 branch_members 목록 조회 허용(운영상 필요)
-- branch_members → branches.brand_id → brand_members로 경유
drop policy if exists "branch_members_select_brand_member" on public.branch_members;
create policy "branch_members_select_brand_member"
on public.branch_members
for select
to authenticated
using (
  exists (
    select 1
    from public.branches b
    join public.brand_members bm on bm.brand_id = b.brand_id
    where b.id = branch_members.branch_id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'::public.member_status
  )
);

-- (MVP) insert/update/delete는 서버 전담 권장: 기본 차단

commit;
