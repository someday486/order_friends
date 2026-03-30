alter table public.branches
  add column if not exists deposit_sheet_name text;

create index if not exists idx_branches_deposit_sheet_name
  on public.branches (deposit_sheet_name)
  where deposit_sheet_name is not null;

alter table public.deposit_match_rows
  add column if not exists branch_id uuid references public.branches(id) on delete cascade;

create index if not exists idx_deposit_match_rows_branch_status
  on public.deposit_match_rows (branch_id, match_status, deposit_date desc);
