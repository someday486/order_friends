begin;

-- 1) ENUM TYPES (이미 있으면 넘어감)
do $$
begin
  create type public.brand_role as enum ('OWNER', 'ADMIN', 'MANAGER', 'MEMBER');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.branch_role as enum ('BRANCH_OWNER', 'BRANCH_ADMIN', 'STAFF', 'VIEWER');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.member_status as enum ('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');
exception when duplicate_object then null;
end $$;

-- 2) brand_members: DEFAULT 제거 → 값 정규화 → 타입 변경 → DEFAULT 재설정
alter table public.brand_members
  alter column role drop default;

alter table public.brand_members
  alter column status drop default;

-- 값 정규화(대문자)
update public.brand_members
  set role = upper(role::text)
where role is not null;

update public.brand_members
  set status = upper(status::text)
where status is not null;

-- NULL 방어(정책에 맞게 조정 가능)
update public.brand_members
  set role = 'MEMBER'
where role is null;

update public.brand_members
  set status = 'ACTIVE'
where status is null;

-- 타입 변경
alter table public.brand_members
  alter column role type public.brand_role
  using (role::text::public.brand_role),
  alter column status type public.member_status
  using (status::text::public.member_status);

-- enum DEFAULT 재설정 + NOT NULL
alter table public.brand_members
  alter column role set default 'MEMBER'::public.brand_role,
  alter column role set not null,
  alter column status set default 'ACTIVE'::public.member_status,
  alter column status set not null;

-- 3) branch_members: DEFAULT 제거 → 값 정규화 → 타입 변경 → DEFAULT 재설정
alter table public.branch_members
  alter column role drop default;

alter table public.branch_members
  alter column status drop default;

update public.branch_members
  set role = upper(role::text)
where role is not null;

update public.branch_members
  set status = upper(status::text)
where status is not null;

update public.branch_members
  set role = 'STAFF'
where role is null;

update public.branch_members
  set status = 'ACTIVE'
where status is null;

alter table public.branch_members
  alter column role type public.branch_role
  using (role::text::public.branch_role),
  alter column status type public.member_status
  using (status::text::public.member_status);

alter table public.branch_members
  alter column role set default 'STAFF'::public.branch_role,
  alter column role set not null,
  alter column status set default 'ACTIVE'::public.member_status,
  alter column status set not null;

-- 4) UNIQUE + INDEXES
create unique index if not exists brand_members_brand_user_uniq
  on public.brand_members (brand_id, user_id);

create unique index if not exists branch_members_branch_user_uniq
  on public.branch_members (branch_id, user_id);

create unique index if not exists brand_members_one_active_owner_per_brand
  on public.brand_members (brand_id)
  where role = 'OWNER'::public.brand_role
    and status = 'ACTIVE'::public.member_status;

create index if not exists brand_members_user_brand_status_idx
  on public.brand_members (user_id, brand_id, status);

create index if not exists branch_members_user_branch_status_idx
  on public.branch_members (user_id, branch_id, status);

create index if not exists branches_brand_id_idx
  on public.branches (brand_id);

commit;
