begin;

-- ============================================================
-- Orders 관련 RLS (Row Level Security) 정책
-- ============================================================

-- RLS 활성화
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_status_history enable row level security;

-- ============================================================
-- Helper Functions
-- ============================================================

-- 사용자가 특정 branch에 접근 가능한지 확인
create or replace function public.can_access_branch(p_branch_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.branch_members bm
    where bm.branch_id = p_branch_id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'
  );
end;
$$ language plpgsql security definer;

-- 사용자가 특정 brand의 모든 branch에 접근 가능한지 확인 (brand 멤버)
create or replace function public.can_access_brand_branches(p_brand_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.brand_members bm
    where bm.brand_id = p_brand_id
      and bm.user_id = auth.uid()
      and bm.status = 'ACTIVE'
  );
end;
$$ language plpgsql security definer;

-- branch_id로 brand_id 조회
create or replace function public.get_brand_id_from_branch(p_branch_id uuid)
returns uuid as $$
  select brand_id from public.branches where id = p_branch_id;
$$ language sql security definer;

-- ============================================================
-- PRODUCTS RLS Policies
-- ============================================================

-- SELECT: branch 멤버 또는 brand 멤버
drop policy if exists "products_select_policy" on public.products;
create policy "products_select_policy" on public.products
  for select using (
    can_access_branch(branch_id) 
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

-- INSERT: branch 멤버 (STAFF 이상)
drop policy if exists "products_insert_policy" on public.products;
create policy "products_insert_policy" on public.products
  for insert with check (
    can_access_branch(branch_id)
  );

-- UPDATE: branch 멤버
drop policy if exists "products_update_policy" on public.products;
create policy "products_update_policy" on public.products
  for update using (
    can_access_branch(branch_id)
  );

-- DELETE: branch 멤버
drop policy if exists "products_delete_policy" on public.products;
create policy "products_delete_policy" on public.products
  for delete using (
    can_access_branch(branch_id)
  );

-- ============================================================
-- PRODUCT_OPTIONS RLS Policies
-- ============================================================

-- SELECT: 상품에 접근 가능하면 옵션도 조회 가능
drop policy if exists "product_options_select_policy" on public.product_options;
create policy "product_options_select_policy" on public.product_options
  for select using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (can_access_branch(p.branch_id) 
             or can_access_brand_branches(get_brand_id_from_branch(p.branch_id)))
    )
  );

-- INSERT
drop policy if exists "product_options_insert_policy" on public.product_options;
create policy "product_options_insert_policy" on public.product_options
  for insert with check (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and can_access_branch(p.branch_id)
    )
  );

-- UPDATE
drop policy if exists "product_options_update_policy" on public.product_options;
create policy "product_options_update_policy" on public.product_options
  for update using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and can_access_branch(p.branch_id)
    )
  );

-- DELETE
drop policy if exists "product_options_delete_policy" on public.product_options;
create policy "product_options_delete_policy" on public.product_options
  for delete using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and can_access_branch(p.branch_id)
    )
  );

-- ============================================================
-- ORDERS RLS Policies
-- ============================================================

-- SELECT: branch 멤버 또는 brand 멤버
drop policy if exists "orders_select_policy" on public.orders;
create policy "orders_select_policy" on public.orders
  for select using (
    can_access_branch(branch_id) 
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

-- INSERT: 퍼블릭 주문 생성 허용 (anon도 가능하게 할 경우)
-- 운영자만 생성하게 하려면 can_access_branch(branch_id) 사용
drop policy if exists "orders_insert_policy" on public.orders;
create policy "orders_insert_policy" on public.orders
  for insert with check (
    -- 일단 인증된 사용자만 (추후 퍼블릭 주문 시 조건 수정)
    auth.uid() is not null
  );

-- UPDATE: branch 멤버만 (상태 변경 등)
drop policy if exists "orders_update_policy" on public.orders;
create policy "orders_update_policy" on public.orders
  for update using (
    can_access_branch(branch_id)
  );

-- DELETE: 일반적으로 주문 삭제 불가 (soft delete 권장)
-- 필요시 관리자만 허용
drop policy if exists "orders_delete_policy" on public.orders;
create policy "orders_delete_policy" on public.orders
  for delete using (
    false  -- 삭제 불가
  );

-- ============================================================
-- ORDER_ITEMS RLS Policies
-- ============================================================

-- SELECT: 주문에 접근 가능하면 항목도 조회 가능
drop policy if exists "order_items_select_policy" on public.order_items;
create policy "order_items_select_policy" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (can_access_branch(o.branch_id) 
             or can_access_brand_branches(get_brand_id_from_branch(o.branch_id)))
    )
  );

-- INSERT: 주문 생성 시 함께 생성
drop policy if exists "order_items_insert_policy" on public.order_items;
create policy "order_items_insert_policy" on public.order_items
  for insert with check (
    auth.uid() is not null
  );

-- UPDATE/DELETE: 일반적으로 불가 (주문 확정 후 변경 불가)
drop policy if exists "order_items_update_policy" on public.order_items;
create policy "order_items_update_policy" on public.order_items
  for update using (false);

drop policy if exists "order_items_delete_policy" on public.order_items;
create policy "order_items_delete_policy" on public.order_items
  for delete using (false);

-- ============================================================
-- ORDER_ITEM_OPTIONS RLS Policies
-- ============================================================

drop policy if exists "order_item_options_select_policy" on public.order_item_options;
create policy "order_item_options_select_policy" on public.order_item_options
  for select using (
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id
        and (can_access_branch(o.branch_id) 
             or can_access_brand_branches(get_brand_id_from_branch(o.branch_id)))
    )
  );

drop policy if exists "order_item_options_insert_policy" on public.order_item_options;
create policy "order_item_options_insert_policy" on public.order_item_options
  for insert with check (auth.uid() is not null);

drop policy if exists "order_item_options_update_policy" on public.order_item_options;
create policy "order_item_options_update_policy" on public.order_item_options
  for update using (false);

drop policy if exists "order_item_options_delete_policy" on public.order_item_options;
create policy "order_item_options_delete_policy" on public.order_item_options
  for delete using (false);

-- ============================================================
-- ORDER_STATUS_HISTORY RLS Policies
-- ============================================================

-- SELECT: 주문에 접근 가능하면 이력도 조회 가능
drop policy if exists "order_status_history_select_policy" on public.order_status_history;
create policy "order_status_history_select_policy" on public.order_status_history
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (can_access_branch(o.branch_id) 
             or can_access_brand_branches(get_brand_id_from_branch(o.branch_id)))
    )
  );

-- INSERT: 트리거에서만 생성 (직접 삽입 불가)
drop policy if exists "order_status_history_insert_policy" on public.order_status_history;
create policy "order_status_history_insert_policy" on public.order_status_history
  for insert with check (false);

-- UPDATE/DELETE: 불가 (감사 로그)
drop policy if exists "order_status_history_update_policy" on public.order_status_history;
create policy "order_status_history_update_policy" on public.order_status_history
  for update using (false);

drop policy if exists "order_status_history_delete_policy" on public.order_status_history;
create policy "order_status_history_delete_policy" on public.order_status_history
  for delete using (false);

commit;
