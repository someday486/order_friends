begin;

alter table public.brands
  add column if not exists is_active boolean not null default true;

create index if not exists brands_is_active_idx
  on public.brands (is_active);

commit;
