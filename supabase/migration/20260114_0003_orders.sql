begin;

-- ============================================================
-- Orders 관련 테이블 마이그레이션
-- ============================================================

-- 1) ENUM TYPES
-- 주문 상태
do $$
begin
  create type public.order_status as enum (
    'CREATED',    -- 주문 생성됨
    'CONFIRMED',  -- 주문 확인됨
    'PREPARING',  -- 준비중
    'READY',      -- 준비완료
    'COMPLETED',  -- 완료
    'CANCELLED',  -- 취소됨
    'REFUNDED'    -- 환불됨
  );
exception when duplicate_object then null;
end $$;

-- 결제 수단
do $$
begin
  create type public.payment_method as enum (
    'CARD',       -- 카드
    'TRANSFER',   -- 계좌이체
    'CASH'        -- 현금
  );
exception when duplicate_object then null;
end $$;

-- 결제 상태
do $$
begin
  create type public.payment_status as enum (
    'PENDING',    -- 결제 대기
    'PAID',       -- 결제 완료
    'FAILED',     -- 결제 실패
    'REFUNDED'    -- 환불됨
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 2) PRODUCTS 테이블 (상품)
-- ============================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  
  name text not null,
  description text,
  price integer not null default 0,  -- 단위: 원
  
  is_active boolean not null default true,
  sort_order integer not null default 0,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is '상품 정보';
comment on column public.products.price is '상품 가격 (원 단위)';

-- ============================================================
-- 3) PRODUCT_OPTIONS 테이블 (상품 옵션)
-- ============================================================
create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  
  name text not null,              -- 옵션명 (예: "사이즈", "맛")
  price_delta integer not null default 0,  -- 추가 금액
  
  is_active boolean not null default true,
  sort_order integer not null default 0,
  
  created_at timestamptz not null default now()
);

comment on table public.product_options is '상품 옵션 (추가 선택 항목)';

-- ============================================================
-- 4) ORDERS 테이블 (주문)
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  
  -- 주문 번호 (표시용, 자동 생성)
  order_no text unique,
  
  -- 주문 상태
  status public.order_status not null default 'CREATED',
  
  -- 고객 정보 (스냅샷)
  customer_name text not null,
  customer_phone text,
  customer_address1 text,
  customer_address2 text,
  customer_memo text,
  
  -- 결제 정보
  payment_method public.payment_method not null default 'CARD',
  payment_status public.payment_status not null default 'PENDING',
  
  -- 금액 정보 (원 단위)
  subtotal_amount integer not null default 0,   -- 상품 소계
  shipping_fee integer not null default 0,      -- 배송비
  discount_amount integer not null default 0,   -- 할인 금액
  total_amount integer not null default 0,      -- 총 결제 금액
  
  -- 타임스탬프
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

comment on table public.orders is '주문 정보';
comment on column public.orders.order_no is '표시용 주문번호 (예: OF-20260114-0001)';
comment on column public.orders.subtotal_amount is '상품 소계 (원 단위)';
comment on column public.orders.total_amount is '총 결제 금액 (원 단위)';

-- ============================================================
-- 5) ORDER_ITEMS 테이블 (주문 상품)
-- ============================================================
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  
  -- 스냅샷 (주문 시점의 상품 정보)
  product_name_snapshot text not null,
  
  qty integer not null default 1,
  unit_price integer not null default 0,  -- 단가 (원 단위)
  
  created_at timestamptz not null default now()
);

comment on table public.order_items is '주문에 포함된 상품 목록';
comment on column public.order_items.product_name_snapshot is '주문 시점의 상품명 (변경되어도 유지)';

-- ============================================================
-- 6) ORDER_ITEM_OPTIONS 테이블 (주문 상품의 옵션)
-- ============================================================
create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_option_id uuid references public.product_options(id) on delete set null,
  
  -- 스냅샷
  option_name_snapshot text not null,
  price_delta_snapshot integer not null default 0,
  
  created_at timestamptz not null default now()
);

comment on table public.order_item_options is '주문 상품에 선택된 옵션';

-- ============================================================
-- 7) ORDER_STATUS_HISTORY 테이블 (주문 상태 변경 이력)
-- ============================================================
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  
  from_status public.order_status,
  to_status public.order_status not null,
  
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now(),
  
  note text  -- 변경 사유 (선택)
);

comment on table public.order_status_history is '주문 상태 변경 이력 (감사 로그)';

-- ============================================================
-- 8) INDEXES
-- ============================================================

-- orders
create index if not exists orders_branch_id_idx on public.orders (branch_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_branch_status_idx on public.orders (branch_id, status);

-- order_items
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- order_item_options
create index if not exists order_item_options_order_item_id_idx on public.order_item_options (order_item_id);

-- order_status_history
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id);

-- products
create index if not exists products_branch_id_idx on public.products (branch_id);
create index if not exists products_branch_active_idx on public.products (branch_id, is_active);

-- product_options
create index if not exists product_options_product_id_idx on public.product_options (product_id);

-- ============================================================
-- 9) FUNCTIONS & TRIGGERS
-- ============================================================

-- 주문번호 자동 생성 함수
create or replace function public.generate_order_no()
returns trigger as $$
declare
  date_part text;
  seq_num integer;
  new_order_no text;
begin
  -- 오늘 날짜 (YYYYMMDD)
  date_part := to_char(now(), 'YYYYMMDD');
  
  -- 오늘 생성된 주문 수 + 1
  select count(*) + 1 into seq_num
  from public.orders
  where created_at::date = now()::date;
  
  -- 주문번호 생성 (예: OF-20260114-0001)
  new_order_no := 'OF-' || date_part || '-' || lpad(seq_num::text, 4, '0');
  
  NEW.order_no := new_order_no;
  return NEW;
end;
$$ language plpgsql;

-- 주문번호 트리거
drop trigger if exists trigger_generate_order_no on public.orders;
create trigger trigger_generate_order_no
  before insert on public.orders
  for each row
  when (NEW.order_no is null)
  execute function public.generate_order_no();

-- updated_at 자동 갱신 함수
create or replace function public.update_updated_at()
returns trigger as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$ language plpgsql;

-- orders updated_at 트리거
drop trigger if exists trigger_orders_updated_at on public.orders;
create trigger trigger_orders_updated_at
  before update on public.orders
  for each row
  execute function public.update_updated_at();

-- products updated_at 트리거
drop trigger if exists trigger_products_updated_at on public.products;
create trigger trigger_products_updated_at
  before update on public.products
  for each row
  execute function public.update_updated_at();

-- 주문 상태 변경 시 이력 자동 기록
create or replace function public.log_order_status_change()
returns trigger as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.order_status_history (order_id, from_status, to_status)
    values (NEW.id, OLD.status, NEW.status);
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_log_order_status on public.orders;
create trigger trigger_log_order_status
  after update on public.orders
  for each row
  execute function public.log_order_status_change();

-- 주문 완료/취소 시 타임스탬프 자동 설정
create or replace function public.set_order_timestamps()
returns trigger as $$
begin
  if NEW.status = 'COMPLETED' and OLD.status != 'COMPLETED' then
    NEW.completed_at := now();
  end if;
  
  if NEW.status = 'CANCELLED' and OLD.status != 'CANCELLED' then
    NEW.cancelled_at := now();
  end if;
  
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trigger_set_order_timestamps on public.orders;
create trigger trigger_set_order_timestamps
  before update on public.orders
  for each row
  execute function public.set_order_timestamps();

commit;
