begin;

-- ============================================================
-- Product Categories + Product Image Support (no helper funcs)
-- ============================================================

-- 1) product_categories table
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (branch_id, name)
);

-- 2) products: add image_url (category_id는 이미 있을 수 있어 if not exists)
alter table public.products
  add column if not exists category_id uuid,
  add column if not exists image_url text;

alter table public.products
  drop constraint if exists products_category_id_fkey;

alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.product_categories(id) on delete set null;

-- ============================================================
-- 3) RLS: product_categories
--    접근 허용 조건:
--    - branch_members에 (branch_id, auth.uid())가 ACTIVE
--    OR
--    - 해당 branch의 brand_id에 대해 brand_members가 ACTIVE
-- ============================================================

alter table public.product_categories enable row level security;

drop policy if exists "product_categories_select_policy" on public.product_categories;
create policy "product_categories_select_policy" on public.product_categories
  for select
  using (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = product_categories.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = product_categories.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  );

drop policy if exists "product_categories_insert_policy" on public.product_categories;
create policy "product_categories_insert_policy" on public.product_categories
  for insert
  with check (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = product_categories.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = product_categories.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  );

drop policy if exists "product_categories_update_policy" on public.product_categories;
create policy "product_categories_update_policy" on public.product_categories
  for update
  using (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = product_categories.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = product_categories.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  )
  with check (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = product_categories.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = product_categories.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  );

drop policy if exists "product_categories_delete_policy" on public.product_categories;
create policy "product_categories_delete_policy" on public.product_categories
  for delete
  using (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = product_categories.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = product_categories.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  );

-- ============================================================
-- 4) products update policy: brand 멤버도 업데이트 허용
-- ============================================================

drop policy if exists "products_update_policy" on public.products;
create policy "products_update_policy" on public.products
  for update
  using (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = products.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = products.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  )
  with check (
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.branch_members bm
        where bm.branch_id = products.branch_id
          and bm.user_id = auth.uid()
          and bm.status = 'ACTIVE'::member_status
      )
      or exists (
        select 1
        from public.branches b
        join public.brand_members brm on brm.brand_id = b.brand_id
        where b.id = products.branch_id
          and brm.user_id = auth.uid()
          and brm.status = 'ACTIVE'::member_status
      )
    )
  );

-- ============================================================
-- 5) Storage: product-images bucket + policies
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

alter table storage.objects enable row level security;

drop policy if exists "product_images_select" on storage.objects;
create policy "product_images_select" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects
  for insert
  with check (bucket_id = 'product-images' and auth.uid() is not null);

-- owner만 update/delete 가능
drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects
  for update using (
    bucket_id = 'product-images'
    and auth.uid() is not null
    and owner = auth.uid()
  );

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and auth.uid() is not null
    and owner = auth.uid()
  );

commit;
