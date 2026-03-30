alter table public.branches
  add column if not exists deposit_sheet_url text;

create index if not exists idx_branches_deposit_sheet_url
  on public.branches (deposit_sheet_url)
  where deposit_sheet_url is not null;
