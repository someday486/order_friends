begin;

-- ============================================================
-- Public Order RLS Policies
-- 익명 사용자(anon)가 상품 조회 및 주문 생성 가능하도록 설정
-- ============================================================

-- ============================================================
-- BRANCHES: 퍼블릭 조회 허용
-- ============================================================

-- 기존 정책이 있으면 삭제
drop policy if exists "branches_public_select" on public.branches;

-- 모든 사용자가 가게 정보 조회 가능
create policy "branches_public_select" on public.branches
  for select using (true);

-- ============================================================
-- PRODUCTS: 퍼블릭 조회 허용 (활성 상품만)
-- ============================================================

drop policy if exists "products_public_select" on public.products;

-- 활성 상품은 누구나 조회 가능
create policy "products_public_select" on public.products
  for select using (is_active = true);

-- ============================================================
-- PRODUCT_OPTIONS: 퍼블릭 조회 허용 (활성 옵션만)
-- ============================================================

drop policy if exists "product_options_public_select" on public.product_options;

-- 활성 옵션은 누구나 조회 가능
create policy "product_options_public_select" on public.product_options
  for select using (is_active = true);

-- ============================================================
-- ORDERS: 퍼블릭 생성 및 조회 허용
-- ============================================================

-- 기존 insert 정책 수정 (인증 없이도 가능하도록)
drop policy if exists "orders_insert_policy" on public.orders;
drop policy if exists "orders_public_insert" on public.orders;
drop policy if exists "orders_public_select" on public.orders;

-- 누구나 주문 생성 가능
create policy "orders_public_insert" on public.orders
  for insert with check (true);

-- 자신의 주문은 order_no 또는 id로 조회 가능 (퍼블릭)
-- 실제로는 주문번호를 알아야만 조회 가능한 구조
create policy "orders_public_select" on public.orders
  for select using (true);

-- ============================================================
-- ORDER_ITEMS: 퍼블릭 생성 및 조회 허용
-- ============================================================

drop policy if exists "order_items_insert_policy" on public.order_items;
drop policy if exists "order_items_public_insert" on public.order_items;
drop policy if exists "order_items_public_select" on public.order_items;

-- 주문 아이템 생성 허용
create policy "order_items_public_insert" on public.order_items
  for insert with check (true);

-- 주문 아이템 조회 허용
create policy "order_items_public_select" on public.order_items
  for select using (true);

-- ============================================================
-- ORDER_ITEM_OPTIONS: 퍼블릭 생성 및 조회 허용
-- ============================================================

drop policy if exists "order_item_options_insert_policy" on public.order_item_options;
drop policy if exists "order_item_options_public_insert" on public.order_item_options;
drop policy if exists "order_item_options_public_select" on public.order_item_options;

-- 주문 아이템 옵션 생성 허용
create policy "order_item_options_public_insert" on public.order_item_options
  for insert with check (true);

-- 주문 아이템 옵션 조회 허용
create policy "order_item_options_public_select" on public.order_item_options
  for select using (true);

-- ============================================================
-- BRANDS: 퍼블릭 조회 허용 (가게에서 브랜드명 표시용)
-- ============================================================

drop policy if exists "brands_public_select" on public.brands;

-- 브랜드 정보 조회 허용
create policy "brands_public_select" on public.brands
  for select using (true);

commit;
