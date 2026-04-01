# Test Data Setup Guide

## Overview

This guide helps you set up comprehensive test data for the Order Friends application, including users with various roles, brands, branches, products, and orders.

## Quick Start

### Step 1: Create Test Users (Supabase Dashboard)

Since `auth.users` is managed by Supabase Auth, you need to create users through the Supabase Dashboard:

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User** → **Create new user**
3. Create the following test users:

| Email | Password | Role | User ID (use this) |
|-------|----------|------|-------------------|
| admin@test.com | test1234 | System Admin | `00000000-0000-0000-0000-000000000001` |
| owner1@test.com | test1234 | Brand Owner (Cafe) | `00000000-0000-0000-0000-000000000002` |
| owner2@test.com | test1234 | Brand Owner (Restaurant) | `00000000-0000-0000-0000-000000000003` |
| manager1@test.com | test1234 | Branch Manager (Gangnam) | `00000000-0000-0000-0000-000000000004` |
| manager2@test.com | test1234 | Branch Manager (Hongdae) | `00000000-0000-0000-0000-000000000005` |
| staff1@test.com | test1234 | Staff (Gangnam) | `00000000-0000-0000-0000-000000000006` |
| staff2@test.com | test1234 | Staff (Hongdae) | `00000000-0000-0000-0000-000000000007` |
| customer@test.com | test1234 | Customer | `00000000-0000-0000-0000-000000000008` |

**IMPORTANT:** When creating users in Supabase Dashboard, use the **exact UUID** from the table above for each user!

#### How to Set User ID in Supabase Dashboard

1. When creating a user, click **Advanced Options**
2. Set **User ID** to the UUID from the table above
3. Make sure **Auto Confirm User** is checked
4. Click **Create User**

### Step 2: Run Seed Script

Go to **SQL Editor** in Supabase Dashboard and run:

```sql
-- Copy and paste the contents of supabase/seed.sql
```

This will create:
- ✅ 8 test user profiles
- ✅ 3 brands (Cafe, Restaurant, Bakery)
- ✅ 4 branches
- ✅ 33 products
- ✅ 12 test orders
- ✅ Branch member assignments
- ✅ Inventory data
- ✅ Payment records

### Step 3: Verify

```sql
-- Check all test data
SELECT 'Profiles' as table_name, COUNT(*) as count
FROM public.profiles
WHERE display_name LIKE 'Test%' OR is_system_admin = TRUE

UNION ALL
SELECT 'Brands', COUNT(*) FROM public.brands WHERE name LIKE 'Test%'

UNION ALL
SELECT 'Branches', COUNT(*) FROM public.branches WHERE name LIKE 'Test%'

UNION ALL
SELECT 'Products', COUNT(*) FROM public.products WHERE name LIKE '테스트%'

UNION ALL
SELECT 'Orders', COUNT(*) FROM public.orders WHERE customer_name LIKE 'Test%';
```

---

## Alternative: Manual User Creation via SQL

If you prefer SQL, you can insert into `auth.users` directly (requires service role key):

```sql
-- WARNING: This bypasses Supabase Auth security
-- Only use in development/testing environments

BEGIN;

-- Insert test users into auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@test.com',
    crypt('test1234', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- Repeat for other users...

COMMIT;
```

---

## Test Scenarios

### Scenario 1: System Admin Login

```
Email: admin@test.com
Password: test1234
Expected: Redirect to /admin with full access to all brands/branches
```

### Scenario 2: Brand Owner Login

```
Email: owner1@test.com
Password: test1234
Expected: Redirect to /admin with access to "Test Cafe Chain" and its branches
```

### Scenario 3: Branch Manager Login

```
Email: manager1@test.com
Password: test1234
Expected: Redirect to /admin with access to "Test Cafe - Gangnam" only
```

### Scenario 4: Staff Login

```
Email: staff1@test.com
Password: test1234
Expected: Redirect to /admin with limited access to "Test Cafe - Gangnam"
```

### Scenario 5: Customer Login

```
Email: customer@test.com
Password: test1234
Expected: Redirect to /customer with general customer access
```

---

## Test Data Structure

### Brands

1. **Test Cafe Chain** (Owner: owner1@test.com)
   - Test Cafe - Gangnam (Manager: manager1@test.com, Staff: staff1@test.com)
   - Test Cafe - Hongdae (Manager: manager2@test.com, Staff: staff2@test.com)

2. **Test Restaurant Group** (Owner: owner2@test.com)
   - Test Restaurant - Main

3. **Test Bakery** (No owner)
   - Test Bakery - Main

### Products per Branch

- **Gangnam Cafe**: 10 products (coffee, beverages, bakery, desserts)
- **Hongdae Cafe**: 8 products (coffee, beverages, bakery, desserts)
- **Restaurant**: 5 products (pasta, pizza, steak, salad, risotto)
- **Bakery**: 5 products (bread, pastries, donuts)

### Orders

- **12 test orders** with various statuses:
  - COMPLETED (7 orders)
  - PENDING (4 orders)
  - CONFIRMED (2 orders)
  - CANCELLED (1 order)

---

## Analytics Testing

With this test data, you can test the analytics dashboard:

```
/customer/analytics?branchId=20000000-0000-0000-0000-000000000001
```

Replace the branchId with:
- Gangnam Cafe: `20000000-0000-0000-0000-000000000001`
- Hongdae Cafe: `20000000-0000-0000-0000-000000000002`
- Restaurant: `20000000-0000-0000-0000-000000000003`
- Bakery: `20000000-0000-0000-0000-000000000004`

---

## Cleanup

To remove all test data:

```sql
BEGIN;

-- Delete in reverse order of foreign key dependencies
DELETE FROM public.payments
WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE 'Test%');

DELETE FROM public.order_items
WHERE order_id IN (SELECT id FROM public.orders WHERE customer_name LIKE 'Test%');

DELETE FROM public.orders
WHERE customer_name LIKE 'Test%';

DELETE FROM public.inventory_logs;

DELETE FROM public.product_inventory
WHERE product_id IN (SELECT id FROM public.products WHERE name LIKE '테스트%');

DELETE FROM public.products
WHERE name LIKE '테스트%';

DELETE FROM public.branch_members;

DELETE FROM public.brand_members;

DELETE FROM public.branches
WHERE name LIKE 'Test%';

DELETE FROM public.brands
WHERE name LIKE 'Test%';

DELETE FROM public.profiles
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008'
);

-- Delete auth users (requires service role)
DELETE FROM auth.users
WHERE email LIKE '%@test.com';

COMMIT;
```

---

## Troubleshooting

### Users not appearing

If profiles are created but users can't log in:
1. Check that users exist in **Authentication** → **Users**
2. Verify email is confirmed
3. Check password is correct

### Foreign key errors

If you get foreign key constraint errors:
1. Make sure user IDs in `auth.users` match the UUIDs in seed script
2. Run migrations first (system_admin_role, create_members_view)
3. Check that profiles are created before brands/branches

### Role not working

If users have wrong roles:
1. Check `profiles.is_system_admin` for system admin
2. Check `brands.owner_id` for brand owners
3. Check `branch_members` table for managers/staff
4. Verify `members` VIEW is created

---

**Last Updated:** 2026-02-06
