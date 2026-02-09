# Members VIEW Documentation

## Overview

The `members` VIEW is a unified interface for querying user memberships across the application. It standardizes role names from the underlying `branch_members` table to match application logic.

## Purpose

### Problem
- Database uses enum types: `BRANCH_ADMIN`, `STAFF`, `BRANCH_OWNER`, `VIEWER`
- Application logic uses strings: `branch_manager`, `staff`, `branch_owner`, `customer`
- Direct table queries require role name mapping in every query

### Solution
- Create a VIEW that handles role name mapping at the database level
- Provides consistent interface for all membership queries
- Centralizes role mapping logic

## Schema

```sql
CREATE VIEW public.members AS
SELECT
  id,               -- UUID
  user_id,          -- UUID (references profiles.id)
  branch_id,        -- UUID (references branches.id)
  status,           -- member_status enum
  created_at,       -- timestamptz
  role              -- TEXT (standardized)
FROM branch_members
WITH role mapping
```

## Role Mapping

| Database Role (branch_role) | View Role (text) | Application Role | Description |
|----------------------------|------------------|------------------|-------------|
| `BRANCH_ADMIN` | `branch_manager` | `branch_manager` | Branch administrator |
| `STAFF` | `staff` | `staff` | Staff member |
| `BRANCH_OWNER` | `branch_owner` | `branch_owner` | Branch owner |
| `VIEWER` | `viewer` | `viewer` | Read-only access |
| *(any other)* | `staff` | `staff` | Default fallback |

## Usage

### Query Examples

```sql
-- Get all memberships for a user
SELECT *
FROM public.members
WHERE user_id = 'user-uuid-here';

-- Get active branch managers
SELECT *
FROM public.members
WHERE role = 'branch_manager'
  AND status = 'ACTIVE';

-- Get user's branches with membership details
SELECT
  m.role,
  m.status,
  b.id as branch_id,
  b.name as branch_name,
  br.id as brand_id,
  br.name as brand_name
FROM public.members m
JOIN public.branches b ON b.id = m.branch_id
JOIN public.brands br ON br.id = b.brand_id
WHERE m.user_id = 'user-uuid-here'
  AND m.status = 'ACTIVE';
```

### Application Usage (NestJS)

```typescript
// Query the members view
const { data: memberships } = await this.supabase
  .adminClient()
  .from('members')  // Uses the VIEW, not a table
  .select(`
    id,
    role,
    branch_id,
    branches:branch_id (
      id,
      name,
      brand_id,
      brands:brand_id (id, name, owner_id)
    )
  `)
  .eq('user_id', userId);

// Roles are already standardized:
// memberships[0].role === 'branch_manager' (not 'BRANCH_ADMIN')
```

## Complete Role Hierarchy

The application uses a complete role hierarchy to determine user access:

### 1. System Admin (Highest)
```sql
profiles.is_system_admin = TRUE
```
- Order Friends company administrators
- Access to all brands and branches
- Bypasses all membership checks

### 2. Brand Owner
```sql
brands.owner_id = user.id
```
- Owns one or more brands
- Full access to their brands and all branches
- Independent of membership tables

### 3. Branch Manager
```sql
members.role = 'branch_manager'
```
*(via VIEW from `branch_members.role = 'BRANCH_ADMIN'`)*
- Manages specific branches
- Higher privileges than staff within their branches

### 4. Staff
```sql
members.role = 'staff'
```
*(via VIEW from `branch_members.role = 'STAFF'`)*
- Works at specific branches
- Standard operational access

### 5. Customer (Default)
- No memberships, not a brand owner, not system admin
- General customer access only

## Migration

### Location
`supabase/migrations/20260206_create_members_view.sql`

### Running the Migration

#### Option 1: Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Paste the contents of the migration file
3. Execute

#### Option 2: Supabase CLI
```bash
supabase db push
```

### Verification

After running the migration, verify the VIEW exists:

```sql
-- Check if view exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'members';

-- Should return:
-- table_name | table_type
-- -----------|-----------
-- members    | VIEW

-- Test the view
SELECT role, count(*)
FROM public.members
GROUP BY role;
```

## Benefits

### 1. **Consistency**
- Same role names throughout the application
- No need for mapping logic in code
- Single source of truth for role names

### 2. **Maintainability**
- Change role mapping in one place
- Existing queries continue to work
- Easy to extend with brand_members later

### 3. **Performance**
- VIEWs are inlined by PostgreSQL
- No performance overhead vs direct table queries
- Can add indexes on underlying tables

### 4. **Backwards Compatibility**
- Existing `.from('members')` code works immediately
- No application code changes needed
- Seamless migration

## Future Enhancements

### Add Brand Members
The VIEW can be extended to include brand-level memberships:

```sql
CREATE OR REPLACE VIEW public.members AS
-- Branch memberships
SELECT
  bm.id,
  bm.user_id,
  bm.branch_id,
  NULL::uuid as brand_id,
  bm.status,
  bm.created_at,
  CASE
    WHEN bm.role = 'BRANCH_ADMIN' THEN 'branch_manager'
    WHEN bm.role = 'STAFF' THEN 'staff'
    ELSE 'staff'
  END::text as role
FROM public.branch_members bm

UNION ALL

-- Brand memberships
SELECT
  brm.id,
  brm.user_id,
  NULL::uuid as branch_id,
  brm.brand_id,
  brm.status,
  brm.created_at,
  CASE
    WHEN brm.role = 'OWNER' THEN 'brand_owner'
    WHEN brm.role = 'ADMIN' THEN 'brand_admin'
    WHEN brm.role = 'MANAGER' THEN 'brand_manager'
    ELSE 'brand_member'
  END::text as role
FROM public.brand_members brm;
```

### Add Computed Columns
```sql
-- Add is_active computed column
ALTER VIEW public.members ADD COLUMN is_active AS (
  status = 'ACTIVE'
);
```

## Troubleshooting

### VIEW not found
```
Error: relation "members" does not exist
```
**Solution:** Run the migration to create the VIEW

### Permission denied
```
Error: permission denied for view members
```
**Solution:** Grant appropriate permissions:
```sql
GRANT SELECT ON public.members TO authenticated;
```

### Role names not matching
```
Expected: 'branch_manager'
Got: 'BRANCH_ADMIN'
```
**Solution:** Ensure you're querying the VIEW, not the table:
```typescript
.from('members')  // ✅ Correct (VIEW)
.from('branch_members')  // ❌ Wrong (table with enum)
```

## Related Documentation

- [System Admin Setup](./SYSTEM_ADMIN_SETUP.md)
- [Database Schema](../supabase/migration/20260114_0000_core_tables.sql)
- [Authorization Enums](../supabase/migration/20260114_0001_authorization.sql)

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
