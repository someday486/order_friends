begin;

-- ============================================================
-- Product Categories + Product Image Support
-- ============================================================

-- product_categories table
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (branch_id, name)
);

-- products: category_id + image_url
alter table public.products
  add column if not exists category_id uuid,
  add column if not exists image_url text;

alter table public.products
  drop constraint if exists products_category_id_fkey;
alter table public.products
  add constraint products_category_id_fkey
  foreign key (category_id) references public.product_categories(id) on delete set null;

-- ============================================================
-- RLS Policies for product_categories
-- ============================================================

alter table public.product_categories enable row level security;

drop policy if exists "product_categories_select_policy" on public.product_categories;
create policy "product_categories_select_policy" on public.product_categories
  for select using (
    can_access_branch(branch_id)
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

drop policy if exists "product_categories_insert_policy" on public.product_categories;
create policy "product_categories_insert_policy" on public.product_categories
  for insert with check (
    can_access_branch(branch_id)
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

drop policy if exists "product_categories_update_policy" on public.product_categories;
create policy "product_categories_update_policy" on public.product_categories
  for update using (
    can_access_branch(branch_id)
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

drop policy if exists "product_categories_delete_policy" on public.product_categories;
create policy "product_categories_delete_policy" on public.product_categories
  for delete using (
    can_access_branch(branch_id)
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

-- ============================================================
-- Update products update policy to allow brand members
-- ============================================================

drop policy if exists "products_update_policy" on public.products;
create policy "products_update_policy" on public.products
  for update using (
    can_access_branch(branch_id)
    or can_access_brand_branches(get_brand_id_from_branch(branch_id))
  );

-- ============================================================
-- Storage: product-images bucket
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

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects
  for update using (bucket_id = 'product-images' and auth.uid() is not null);

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.uid() is not null);

commit;
