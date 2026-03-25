create table if not exists public.deposit_match_rows (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id text not null,
  sheet_name text not null,
  row_number integer not null,
  deposit_date date not null,
  deposited_at timestamptz,
  amount integer not null check (amount >= 0),
  depositor_name text,
  depositor_name_normalized text,
  source_number text,
  raw_text text,
  match_status text not null default 'PENDING' check (match_status in ('PENDING', 'MATCHED')),
  matched_order_id uuid references public.orders(id) on delete set null,
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spreadsheet_id, sheet_name, row_number)
);

create index if not exists idx_deposit_match_rows_status
  on public.deposit_match_rows (match_status, deposit_date desc);

create index if not exists idx_deposit_match_rows_order
  on public.deposit_match_rows (matched_order_id);

create index if not exists idx_deposit_match_rows_lookup
  on public.deposit_match_rows (deposit_date, amount, depositor_name_normalized);

create or replace function public.update_deposit_match_rows_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_deposit_match_rows_updated_at on public.deposit_match_rows;
create trigger trg_deposit_match_rows_updated_at
  before update on public.deposit_match_rows
  for each row
  execute function public.update_deposit_match_rows_updated_at();
