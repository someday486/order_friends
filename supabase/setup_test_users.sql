-- ============================================================================
-- Step 1: Create Test Users in Supabase Dashboard
-- ============================================================================
-- Go to Authentication → Users → Add User
-- Create these 8 users with any email/password:
--
-- 1. admin@test.com (password: test1234)
-- 2. owner1@test.com (password: test1234)
-- 3. owner2@test.com (password: test1234)
-- 4. manager1@test.com (password: test1234)
-- 5. manager2@test.com (password: test1234)
-- 6. staff1@test.com (password: test1234)
-- 7. staff2@test.com (password: test1234)
-- 8. customer@test.com (password: test1234)
--
-- ============================================================================
-- Step 2: Get User IDs
-- ============================================================================
-- Run this query to get all the user IDs:

SELECT
  id,
  email,
  created_at
FROM auth.users
WHERE email IN (
  'admin@test.com',
  'owner1@test.com',
  'owner2@test.com',
  'manager1@test.com',
  'manager2@test.com',
  'staff1@test.com',
  'staff2@test.com',
  'customer@test.com'
)
ORDER BY email;

-- ============================================================================
-- Step 3: Copy the UUIDs and replace in the script below
-- ============================================================================
-- Replace the UUIDs below with the actual IDs from Step 2

DO $$
DECLARE
  -- REPLACE THESE UUIDs WITH ACTUAL USER IDs FROM STEP 2
  admin_user_id UUID := 'REPLACE-WITH-ADMIN-UUID';
  brand_owner1_id UUID := 'REPLACE-WITH-OWNER1-UUID';
  brand_owner2_id UUID := 'REPLACE-WITH-OWNER2-UUID';
  manager1_id UUID := 'REPLACE-WITH-MANAGER1-UUID';
  manager2_id UUID := 'REPLACE-WITH-MANAGER2-UUID';
  staff1_id UUID := 'REPLACE-WITH-STAFF1-UUID';
  staff2_id UUID := 'REPLACE-WITH-STAFF2-UUID';
  customer1_id UUID := 'REPLACE-WITH-CUSTOMER-UUID';

  -- Brand IDs (these are fine as-is)
  brand_cafe_id UUID := '10000000-0000-0000-0000-000000000001';
  brand_restaurant_id UUID := '10000000-0000-0000-0000-000000000002';
  brand_bakery_id UUID := '10000000-0000-0000-0000-000000000003';

  -- Branch IDs (these are fine as-is)
  branch_cafe_gangnam_id UUID := '20000000-0000-0000-0000-000000000001';
  branch_cafe_hongdae_id UUID := '20000000-0000-0000-0000-000000000002';
  branch_restaurant_main_id UUID := '20000000-0000-0000-0000-000000000003';
  branch_bakery_main_id UUID := '20000000-0000-0000-0000-000000000004';

BEGIN
  -- ============================================================================
  -- Create Profiles
  -- ============================================================================

  -- System Admin
  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES (admin_user_id, 'System Admin', '010-0000-0001', TRUE)
  ON CONFLICT (id) DO UPDATE SET is_system_admin = TRUE;

  -- Brand Owners
  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES
    (brand_owner1_id, 'Brand Owner 1 (Cafe)', '010-0000-0002', FALSE),
    (brand_owner2_id, 'Brand Owner 2 (Restaurant)', '010-0000-0003', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Managers
  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES
    (manager1_id, 'Manager 1 (Gangnam Cafe)', '010-0000-0004', FALSE),
    (manager2_id, 'Manager 2 (Hongdae Cafe)', '010-0000-0005', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Staff
  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES
    (staff1_id, 'Staff 1 (Gangnam)', '010-0000-0006', FALSE),
    (staff2_id, 'Staff 2 (Hongdae)', '010-0000-0007', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- Customer
  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES (customer1_id, 'Test Customer', '010-0000-0008', FALSE)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================================
  -- Create Brands
  -- ============================================================================

  INSERT INTO public.brands (id, name, owner_user_id, biz_name, biz_reg_no)
  VALUES
    (brand_cafe_id, 'Test Cafe Chain', brand_owner1_id, '(주)테스트카페', '123-45-67890'),
    (brand_restaurant_id, 'Test Restaurant Group', brand_owner2_id, '(주)테스트레스토랑', '123-45-67891'),
    (brand_bakery_id, 'Test Bakery', NULL, '(주)테스트베이커리', '123-45-67892')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================================
  -- Create Branches
  -- ============================================================================

  INSERT INTO public.branches (id, brand_id, name)
  VALUES
    (branch_cafe_gangnam_id, brand_cafe_id, 'Test Cafe - Gangnam'),
    (branch_cafe_hongdae_id, brand_cafe_id, 'Test Cafe - Hongdae'),
    (branch_restaurant_main_id, brand_restaurant_id, 'Test Restaurant - Main'),
    (branch_bakery_main_id, brand_bakery_id, 'Test Bakery - Main')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================================
  -- Assign Branch Members
  -- ============================================================================

  -- Managers
  INSERT INTO public.branch_members (branch_id, user_id, role, status)
  VALUES
    (branch_cafe_gangnam_id, manager1_id, 'BRANCH_ADMIN', 'ACTIVE'),
    (branch_cafe_hongdae_id, manager2_id, 'BRANCH_ADMIN', 'ACTIVE')
  ON CONFLICT DO NOTHING;

  -- Staff
  INSERT INTO public.branch_members (branch_id, user_id, role, status)
  VALUES
    (branch_cafe_gangnam_id, staff1_id, 'STAFF', 'ACTIVE'),
    (branch_cafe_hongdae_id, staff2_id, 'STAFF', 'ACTIVE')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- Create Products
  -- ============================================================================

  -- Cafe Products (Gangnam)
  INSERT INTO public.products (branch_id, name, price, category, description)
  VALUES
    (branch_cafe_gangnam_id, '테스트 아메리카노', 4500, 'coffee', '깊고 진한 에스프레소'),
    (branch_cafe_gangnam_id, '테스트 카페라떼', 5000, 'coffee', '부드러운 우유와 에스프레소'),
    (branch_cafe_gangnam_id, '테스트 카푸치노', 5000, 'coffee', '크리미한 폼이 일품'),
    (branch_cafe_gangnam_id, '테스트 바닐라라떼', 5500, 'coffee', '달콤한 바닐라향'),
    (branch_cafe_gangnam_id, '테스트 카라멜마끼아또', 5500, 'coffee', '달콤한 카라멜 시럽'),
    (branch_cafe_gangnam_id, '테스트 초코라떼', 5500, 'beverage', '진한 초콜릿'),
    (branch_cafe_gangnam_id, '테스트 녹차라떼', 5500, 'beverage', '고소한 녹차'),
    (branch_cafe_gangnam_id, '테스트 크로와상', 3500, 'bakery', '버터향 가득'),
    (branch_cafe_gangnam_id, '테스트 치즈케이크', 6000, 'dessert', '부드러운 치즈케이크'),
    (branch_cafe_gangnam_id, '테스트 티라미수', 6500, 'dessert', '이탈리안 디저트')
  ON CONFLICT DO NOTHING;

  -- Cafe Products (Hongdae)
  INSERT INTO public.products (branch_id, name, price, category, description)
  VALUES
    (branch_cafe_hongdae_id, '테스트 아메리카노', 4500, 'coffee', '깊고 진한 에스프레소'),
    (branch_cafe_hongdae_id, '테스트 카페라떼', 5000, 'coffee', '부드러운 우유와 에스프레소'),
    (branch_cafe_hongdae_id, '테스트 콜드브루', 5000, 'coffee', '차가운 커피'),
    (branch_cafe_hongdae_id, '테스트 아이스티', 4500, 'beverage', '시원한 차'),
    (branch_cafe_hongdae_id, '테스트 레몬에이드', 5000, 'beverage', '상큼한 레몬'),
    (branch_cafe_hongdae_id, '테스트 마들렌', 3000, 'bakery', '달콤한 마들렌'),
    (branch_cafe_hongdae_id, '테스트 스콘', 3500, 'bakery', '영국식 스콘'),
    (branch_cafe_hongdae_id, '테스트 브라우니', 4000, 'dessert', '초콜릿 브라우니')
  ON CONFLICT DO NOTHING;

  -- Restaurant Products
  INSERT INTO public.products (branch_id, name, price, category, description)
  VALUES
    (branch_restaurant_main_id, '테스트 파스타', 15000, 'pasta', '정통 이탈리안'),
    (branch_restaurant_main_id, '테스트 피자', 20000, 'pizza', '오븐에 구운 피자'),
    (branch_restaurant_main_id, '테스트 리조또', 18000, 'rice', '크리미한 리조또'),
    (branch_restaurant_main_id, '테스트 스테이크', 35000, 'meat', '프리미엄 스테이크'),
    (branch_restaurant_main_id, '테스트 샐러드', 12000, 'salad', '신선한 채소')
  ON CONFLICT DO NOTHING;

  -- Bakery Products
  INSERT INTO public.products (branch_id, name, price, category, description)
  VALUES
    (branch_bakery_main_id, '테스트 식빵', 5000, 'bread', '촉촉한 식빵'),
    (branch_bakery_main_id, '테스트 바게트', 4000, 'bread', '프랑스 바게트'),
    (branch_bakery_main_id, '테스트 단팥빵', 2500, 'pastry', '달콤한 단팥'),
    (branch_bakery_main_id, '테스트 크림빵', 2500, 'pastry', '부드러운 크림'),
    (branch_bakery_main_id, '테스트 도넛', 2000, 'pastry', '달콤한 도넛')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- Create Inventory
  -- ============================================================================

  INSERT INTO public.product_inventory (product_id, quantity, min_quantity, max_quantity)
  SELECT
    id as product_id,
    100 as quantity,
    10 as min_quantity,
    200 as max_quantity
  FROM public.products
  WHERE name LIKE '테스트%'
  ON CONFLICT (product_id) DO NOTHING;

  -- ============================================================================
  -- Create Test Orders
  -- ============================================================================

  WITH new_orders AS (
    INSERT INTO public.orders (
      branch_id,
      customer_name,
      customer_phone,
      total_amount,
      status,
      created_at
    )
    VALUES
      (branch_cafe_gangnam_id, 'Test Customer A', '010-1111-1111', 14500, 'COMPLETED', NOW() - INTERVAL '1 hour'),
      (branch_cafe_gangnam_id, 'Test Customer B', '010-2222-2222', 10000, 'COMPLETED', NOW() - INTERVAL '2 hours'),
      (branch_cafe_gangnam_id, 'Test Customer C', '010-3333-3333', 9000, 'PENDING', NOW() - INTERVAL '30 minutes'),
      (branch_cafe_gangnam_id, 'Test Customer D', '010-4444-4444', 15500, 'CONFIRMED', NOW() - INTERVAL '1 hour'),
      (branch_cafe_hongdae_id, 'Test Customer E', '010-5555-5555', 12000, 'COMPLETED', NOW() - INTERVAL '2 hours'),
      (branch_cafe_hongdae_id, 'Test Customer F', '010-6666-6666', 8500, 'CANCELLED', NOW() - INTERVAL '4 hours'),
      (branch_restaurant_main_id, 'Test Customer G', '010-7777-7777', 50000, 'COMPLETED', NOW() - INTERVAL '1 day'),
      (branch_bakery_main_id, 'Test Customer H', '010-8888-8888', 15000, 'COMPLETED', NOW() - INTERVAL '2 hours')
    RETURNING id, branch_id
  )
  INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, subtotal)
  SELECT
    o.id,
    p.id,
    2 as quantity,
    p.price,
    p.price * 2
  FROM new_orders o
  CROSS JOIN LATERAL (
    SELECT id, price
    FROM public.products
    WHERE branch_id = o.branch_id
    ORDER BY random()
    LIMIT 1
  ) p;

  -- ============================================================================
  -- Create Payments
  -- ============================================================================

  INSERT INTO public.payments (order_id, amount, method, status)
  SELECT
    id,
    total_amount,
    CASE (random() * 3)::int
      WHEN 0 THEN 'CASH'
      WHEN 1 THEN 'CARD'
      ELSE 'TRANSFER'
    END,
    CASE status
      WHEN 'COMPLETED' THEN 'COMPLETED'
      WHEN 'CONFIRMED' THEN 'COMPLETED'
      WHEN 'CANCELLED' THEN 'FAILED'
      ELSE 'PENDING'
    END
  FROM public.orders
  WHERE customer_name LIKE 'Test Customer%';

  RAISE NOTICE 'Test data created successfully!';
  RAISE NOTICE 'admin_user_id: %', admin_user_id;
  RAISE NOTICE 'brand_owner1_id: %', brand_owner1_id;

END $$;

-- ============================================================================
-- Verify
-- ============================================================================

SELECT 'Created!' as status, COUNT(*) as count
FROM public.profiles
WHERE display_name LIKE '%Test%' OR display_name LIKE '%Admin%';
