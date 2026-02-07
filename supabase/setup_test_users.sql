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
  admin_user_id UUID := 'b1732433-0c16-4f38-b2c4-d704803b7066';
  brand_owner1_id UUID := 'f5adf7e6-c18c-4ee5-80cd-c8ebe87e5843';
  brand_owner2_id UUID := 'e3c89916-68b6-4dc0-b9ab-cf0811f83c82';
  manager1_id UUID := '3736f74c-9172-4ec4-8ce4-ce313b6f6635';
  manager2_id UUID := '6cbd6b90-ad5a-460a-a398-7b4c7af83c22';
  staff1_id UUID := '7b7565cb-1460-4b94-b905-8d9561170c9a';
  staff2_id UUID := 'e5847401-e1bc-40a8-8972-8bbdbd103a70';
  customer1_id UUID := 'f925150c-06cc-4927-b404-df839f29a8d8';

  -- Brand IDs
  brand_cafe_id UUID := '10000000-0000-0000-0000-000000000001';
  brand_restaurant_id UUID := '10000000-0000-0000-0000-000000000002';
  brand_bakery_id UUID := '10000000-0000-0000-0000-000000000003';

  -- Branch IDs
  branch_cafe_gangnam_id UUID := '20000000-0000-0000-0000-000000000001';
  branch_cafe_hongdae_id UUID := '20000000-0000-0000-0000-000000000002';
  branch_restaurant_main_id UUID := '20000000-0000-0000-0000-000000000003';
  branch_bakery_main_id UUID := '20000000-0000-0000-0000-000000000004';

  -- Channel IDs
  channel_cafe_gangnam_id UUID := '30000000-0000-0000-0000-000000000001';
  channel_cafe_hongdae_id UUID := '30000000-0000-0000-0000-000000000002';
  channel_restaurant_main_id UUID := '30000000-0000-0000-0000-000000000003';
  channel_bakery_main_id UUID := '30000000-0000-0000-0000-000000000004';

BEGIN
  -- ============================================================================
  -- Create Profiles
  -- ============================================================================

  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES (admin_user_id, 'Test System Admin', '010-0000-0001', TRUE)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone, is_system_admin = TRUE;

  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES
    (brand_owner1_id, 'Test Brand Owner 1 (Cafe)', '010-0000-0002', FALSE),
    (brand_owner2_id, 'Test Brand Owner 2 (Restaurant)', '010-0000-0003', FALSE)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone;

  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES
    (manager1_id, 'Test Manager 1 (Gangnam Cafe)', '010-0000-0004', FALSE),
    (manager2_id, 'Test Manager 2 (Hongdae Cafe)', '010-0000-0005', FALSE)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone;

  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES
    (staff1_id, 'Test Staff 1 (Gangnam)', '010-0000-0006', FALSE),
    (staff2_id, 'Test Staff 2 (Hongdae)', '010-0000-0007', FALSE)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone;

  INSERT INTO public.profiles (id, display_name, phone, is_system_admin)
  VALUES (customer1_id, 'Test Customer', '010-0000-0008', FALSE)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone;

  -- ============================================================================
  -- Create Brands
  -- ============================================================================

  INSERT INTO public.brands (id, name, slug, owner_user_id, biz_name, biz_reg_no)
  VALUES
    (brand_cafe_id, 'Test Cafe Chain', 'test-cafe-chain', brand_owner1_id, '(주)테스트카페', '123-45-67890'),
    (brand_restaurant_id, 'Test Restaurant Group', 'test-restaurant-group', brand_owner2_id, '(주)테스트레스토랑', '123-45-67891'),
    (brand_bakery_id, 'Test Bakery', 'test-bakery', NULL, '(주)테스트베이커리', '123-45-67892')
  ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug;

  -- ============================================================================
  -- Create Branches
  -- ============================================================================

  INSERT INTO public.branches (id, brand_id, name, slug)
  VALUES
    (branch_cafe_gangnam_id, brand_cafe_id, 'Test Cafe - Gangnam', 'gangnam'),
    (branch_cafe_hongdae_id, brand_cafe_id, 'Test Cafe - Hongdae', 'hongdae'),
    (branch_restaurant_main_id, brand_restaurant_id, 'Test Restaurant - Main', 'main'),
    (branch_bakery_main_id, brand_bakery_id, 'Test Bakery - Main', 'main')
  ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug;

  -- ============================================================================
  -- Create Order Channels (required for order creation trigger)
  -- ============================================================================

  INSERT INTO public.order_channels (id, branch_id, type, slug, is_active)
  VALUES
    (channel_cafe_gangnam_id, branch_cafe_gangnam_id, 'PICKUP', 'test-cafe-gangnam', TRUE),
    (channel_cafe_hongdae_id, branch_cafe_hongdae_id, 'PICKUP', 'test-cafe-hongdae', TRUE),
    (channel_restaurant_main_id, branch_restaurant_main_id, 'PICKUP', 'test-restaurant-main', TRUE),
    (channel_bakery_main_id, branch_bakery_main_id, 'DELIVERY', 'test-bakery-main', TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================================
  -- Assign Brand Members (owners)
  -- ============================================================================

  INSERT INTO public.brand_members (brand_id, user_id, role, status)
  VALUES
    (brand_cafe_id, brand_owner1_id, 'OWNER', 'ACTIVE'),
    (brand_restaurant_id, brand_owner2_id, 'OWNER', 'ACTIVE')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- Assign Branch Members
  -- ============================================================================

  INSERT INTO public.branch_members (branch_id, user_id, role, status)
  VALUES
    (branch_cafe_gangnam_id, manager1_id, 'BRANCH_ADMIN', 'ACTIVE'),
    (branch_cafe_hongdae_id, manager2_id, 'BRANCH_ADMIN', 'ACTIVE')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.branch_members (branch_id, user_id, role, status)
  VALUES
    (branch_cafe_gangnam_id, staff1_id, 'STAFF', 'ACTIVE'),
    (branch_cafe_hongdae_id, staff2_id, 'STAFF', 'ACTIVE')
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- Create Products
  -- ============================================================================

  -- Cafe Products (Gangnam)
  INSERT INTO public.products (branch_id, name, base_price, description)
  VALUES
    (branch_cafe_gangnam_id, '테스트 아메리카노', 4500, '깊고 진한 에스프레소'),
    (branch_cafe_gangnam_id, '테스트 카페라떼', 5000, '부드러운 우유와 에스프레소'),
    (branch_cafe_gangnam_id, '테스트 카푸치노', 5000, '크리미한 폼이 일품'),
    (branch_cafe_gangnam_id, '테스트 바닐라라떼', 5500, '달콤한 바닐라향'),
    (branch_cafe_gangnam_id, '테스트 카라멜마끼아또', 5500, '달콤한 카라멜 시럽'),
    (branch_cafe_gangnam_id, '테스트 초코라떼', 5500, '진한 초콜릿'),
    (branch_cafe_gangnam_id, '테스트 녹차라떼', 5500, '고소한 녹차'),
    (branch_cafe_gangnam_id, '테스트 크로와상', 3500, '버터향 가득'),
    (branch_cafe_gangnam_id, '테스트 치즈케이크', 6000, '부드러운 치즈케이크'),
    (branch_cafe_gangnam_id, '테스트 티라미수', 6500, '이탈리안 디저트');

  -- Cafe Products (Hongdae)
  INSERT INTO public.products (branch_id, name, base_price, description)
  VALUES
    (branch_cafe_hongdae_id, '테스트 아메리카노', 4500, '깊고 진한 에스프레소'),
    (branch_cafe_hongdae_id, '테스트 카페라떼', 5000, '부드러운 우유와 에스프레소'),
    (branch_cafe_hongdae_id, '테스트 콜드브루', 5000, '차가운 커피'),
    (branch_cafe_hongdae_id, '테스트 아이스티', 4500, '시원한 차'),
    (branch_cafe_hongdae_id, '테스트 레몬에이드', 5000, '상큼한 레몬'),
    (branch_cafe_hongdae_id, '테스트 마들렌', 3000, '달콤한 마들렌'),
    (branch_cafe_hongdae_id, '테스트 스콘', 3500, '영국식 스콘'),
    (branch_cafe_hongdae_id, '테스트 브라우니', 4000, '초콜릿 브라우니');

  -- Restaurant Products
  INSERT INTO public.products (branch_id, name, base_price, description)
  VALUES
    (branch_restaurant_main_id, '테스트 파스타', 15000, '정통 이탈리안'),
    (branch_restaurant_main_id, '테스트 피자', 20000, '오븐에 구운 피자'),
    (branch_restaurant_main_id, '테스트 리조또', 18000, '크리미한 리조또'),
    (branch_restaurant_main_id, '테스트 스테이크', 35000, '프리미엄 스테이크'),
    (branch_restaurant_main_id, '테스트 샐러드', 12000, '신선한 채소');

  -- Bakery Products
  INSERT INTO public.products (branch_id, name, base_price, description)
  VALUES
    (branch_bakery_main_id, '테스트 식빵', 5000, '촉촉한 식빵'),
    (branch_bakery_main_id, '테스트 바게트', 4000, '프랑스 바게트'),
    (branch_bakery_main_id, '테스트 단팥빵', 2500, '달콤한 단팥'),
    (branch_bakery_main_id, '테스트 크림빵', 2500, '부드러운 크림'),
    (branch_bakery_main_id, '테스트 도넛', 2000, '달콤한 도넛');

  -- ============================================================================
  -- Create Inventory
  -- ============================================================================

  INSERT INTO public.product_inventory (product_id, branch_id, qty_available, qty_reserved, qty_sold, low_stock_threshold)
  SELECT
    p.id,
    p.branch_id,
    100, 0, 0, 10
  FROM public.products p
  WHERE p.name LIKE '테스트%'
  ON CONFLICT DO NOTHING;

  -- ============================================================================
  -- Create Test Orders
  -- Trigger auto-sets: branch_id, brand_id from channel_id
  -- Trigger forces: status = 'CREATED'
  -- So we INSERT first, then UPDATE status separately
  -- ============================================================================

  -- Gangnam Cafe orders
  INSERT INTO public.orders (channel_id, fulfillment_type, customer_name, customer_phone, created_at)
  VALUES
    (channel_cafe_gangnam_id, 'PICKUP', 'Test Customer A', '010-1111-1111', NOW() - INTERVAL '1 hour'),
    (channel_cafe_gangnam_id, 'PICKUP', 'Test Customer B', '010-2222-2222', NOW() - INTERVAL '2 hours'),
    (channel_cafe_gangnam_id, 'DELIVERY', 'Test Customer C', '010-3333-3333', NOW() - INTERVAL '30 minutes'),
    (channel_cafe_gangnam_id, 'PICKUP', 'Test Customer D', '010-4444-4444', NOW() - INTERVAL '1 hour'),
    (channel_cafe_gangnam_id, 'DELIVERY', 'Test Customer E', '010-5555-5555', NOW() - INTERVAL '45 minutes');

  -- Hongdae Cafe orders
  INSERT INTO public.orders (channel_id, fulfillment_type, customer_name, customer_phone, created_at)
  VALUES
    (channel_cafe_hongdae_id, 'PICKUP', 'Test Customer F', '010-6666-6666', NOW() - INTERVAL '2 hours'),
    (channel_cafe_hongdae_id, 'PICKUP', 'Test Customer G', '010-7777-7777', NOW() - INTERVAL '4 hours'),
    (channel_cafe_hongdae_id, 'DELIVERY', 'Test Customer H', '010-8888-8888', NOW() - INTERVAL '15 minutes');

  -- Restaurant orders
  INSERT INTO public.orders (channel_id, fulfillment_type, customer_name, customer_phone, created_at)
  VALUES
    (channel_restaurant_main_id, 'PICKUP', 'Test Customer I', '010-9999-0001', NOW() - INTERVAL '1 day'),
    (channel_restaurant_main_id, 'PICKUP', 'Test Customer J', '010-9999-0002', NOW() - INTERVAL '30 minutes');

  -- Bakery orders
  INSERT INTO public.orders (channel_id, fulfillment_type, customer_name, customer_phone, created_at)
  VALUES
    (channel_bakery_main_id, 'DELIVERY', 'Test Customer K', '010-9999-0003', NOW() - INTERVAL '2 hours'),
    (channel_bakery_main_id, 'DELIVERY', 'Test Customer L', '010-9999-0004', NOW() - INTERVAL '10 minutes');

  -- ============================================================================
  -- Add Order Items
  -- ============================================================================

  INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, unit_price_snapshot, qty, line_total)
  SELECT
    o.id,
    p.id,
    p.name,
    p.base_price,
    2,
    p.base_price * 2
  FROM public.orders o
  CROSS JOIN LATERAL (
    SELECT id, name, base_price
    FROM public.products
    WHERE branch_id = o.branch_id
    ORDER BY random()
    LIMIT 2
  ) p
  WHERE o.customer_name LIKE 'Test Customer%';

  -- Update order totals based on order items
  UPDATE public.orders o
  SET
    subtotal = sub.total,
    total_amount = sub.total
  FROM (
    SELECT order_id, SUM(line_total) as total
    FROM public.order_items
    WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE 'Test Customer%')
    GROUP BY order_id
  ) sub
  WHERE o.id = sub.order_id;

  -- ============================================================================
  -- Update Order Statuses
  -- Must follow transition order: CREATED → CONFIRMED → PREPARING → READY → COMPLETED
  -- ============================================================================

  -- Test Customer A: CREATED → CONFIRMED → PREPARING → READY → COMPLETED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer A';
  UPDATE public.orders SET status = 'PREPARING' WHERE customer_name = 'Test Customer A';
  UPDATE public.orders SET status = 'READY' WHERE customer_name = 'Test Customer A';
  UPDATE public.orders SET status = 'COMPLETED' WHERE customer_name = 'Test Customer A';

  -- Test Customer B: CREATED → CONFIRMED → PREPARING → READY → COMPLETED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer B';
  UPDATE public.orders SET status = 'PREPARING' WHERE customer_name = 'Test Customer B';
  UPDATE public.orders SET status = 'READY' WHERE customer_name = 'Test Customer B';
  UPDATE public.orders SET status = 'COMPLETED' WHERE customer_name = 'Test Customer B';

  -- Test Customer C: stays CREATED

  -- Test Customer D: CREATED → CONFIRMED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer D';

  -- Test Customer E: CREATED → CONFIRMED → PREPARING
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer E';
  UPDATE public.orders SET status = 'PREPARING' WHERE customer_name = 'Test Customer E';

  -- Test Customer F: CREATED → CONFIRMED → PREPARING → READY → COMPLETED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer F';
  UPDATE public.orders SET status = 'PREPARING' WHERE customer_name = 'Test Customer F';
  UPDATE public.orders SET status = 'READY' WHERE customer_name = 'Test Customer F';
  UPDATE public.orders SET status = 'COMPLETED' WHERE customer_name = 'Test Customer F';

  -- Test Customer G: CREATED → CANCELLED
  UPDATE public.orders SET status = 'CANCELLED' WHERE customer_name = 'Test Customer G';

  -- Test Customer H: stays CREATED

  -- Test Customer I: CREATED → CONFIRMED → PREPARING → READY → COMPLETED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer I';
  UPDATE public.orders SET status = 'PREPARING' WHERE customer_name = 'Test Customer I';
  UPDATE public.orders SET status = 'READY' WHERE customer_name = 'Test Customer I';
  UPDATE public.orders SET status = 'COMPLETED' WHERE customer_name = 'Test Customer I';

  -- Test Customer J: CREATED → CONFIRMED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer J';

  -- Test Customer K: CREATED → CONFIRMED → PREPARING → READY → COMPLETED
  UPDATE public.orders SET status = 'CONFIRMED' WHERE customer_name = 'Test Customer K';
  UPDATE public.orders SET status = 'PREPARING' WHERE customer_name = 'Test Customer K';
  UPDATE public.orders SET status = 'READY' WHERE customer_name = 'Test Customer K';
  UPDATE public.orders SET status = 'COMPLETED' WHERE customer_name = 'Test Customer K';

  -- Test Customer L: stays CREATED

  -- ============================================================================
  -- Create Payments
  -- ============================================================================

  -- Disable payment trigger (it has a bug: tries to set order status to 'PENDING' which is not a valid enum)
  ALTER TABLE public.payments DISABLE TRIGGER update_order_on_payment_status_change;

  INSERT INTO public.payments (order_id, amount, payment_method, status, currency, provider)
  SELECT
    id,
    total_amount,
    CASE (random() * 2)::int
      WHEN 0 THEN 'CARD'
      WHEN 1 THEN 'CASH'
      ELSE 'TRANSFER'
    END,
    CASE status
      WHEN 'COMPLETED' THEN 'SUCCESS'
      WHEN 'CONFIRMED' THEN 'SUCCESS'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      ELSE 'PENDING'
    END,
    'KRW',
    'MANUAL'
  FROM public.orders
  WHERE customer_name LIKE 'Test Customer%'
    AND status != 'CREATED';

  ALTER TABLE public.payments ENABLE TRIGGER update_order_on_payment_status_change;

  RAISE NOTICE 'Test data created successfully!';

END $$;

-- ============================================================================
-- Verify
-- ============================================================================

SELECT '✅ Profiles' as item, COUNT(*) as count FROM public.profiles WHERE display_name LIKE '%Test%' OR display_name LIKE '%Admin%'
UNION ALL SELECT '✅ Brands', COUNT(*) FROM public.brands WHERE name LIKE 'Test%'
UNION ALL SELECT '✅ Branches', COUNT(*) FROM public.branches WHERE name LIKE 'Test%'
UNION ALL SELECT '✅ Channels', COUNT(*) FROM public.order_channels WHERE slug LIKE 'test-%'
UNION ALL SELECT '✅ Products', COUNT(*) FROM public.products WHERE name LIKE '테스트%'
UNION ALL SELECT '✅ Inventory', COUNT(*) FROM public.product_inventory WHERE product_id IN (SELECT id FROM public.products WHERE name LIKE '테스트%')
UNION ALL SELECT '✅ Orders', COUNT(*) FROM public.orders WHERE customer_name LIKE 'Test%'
UNION ALL SELECT '✅ Order Items', COUNT(*) FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE 'Test%')
UNION ALL SELECT '✅ Payments', COUNT(*) FROM public.payments WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE 'Test%');
