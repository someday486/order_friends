alter table public.branches
  add column if not exists is_active boolean not null default true;

update public.branches
set is_active = true
where is_active is null;

create index if not exists branches_is_active_idx
  on public.branches (is_active);
