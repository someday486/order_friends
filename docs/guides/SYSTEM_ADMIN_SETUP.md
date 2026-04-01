# System Admin Setup Guide

## Overview

System administrators are Order Friends company administrators who have access to all brands and branches in the system. This is the highest level of access in the application.

## Role Hierarchy

1. **system_admin** (highest) - Order Friends company administrators
2. **brand_owner** - Brand owners
3. **branch_manager** - Branch managers
4. **staff** - Staff members
5. **customer** (lowest) - Regular customers

## Database Migration

The system admin feature requires a database migration to add the `is_system_admin` column to the `profiles` table.

### Migration File

Location: `supabase/migrations/20260206_system_admin_role.sql`

### Running the Migration

#### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `20260206_system_admin_role.sql`
4. Execute the SQL

#### Option 2: Using Supabase CLI

```bash
# Make sure you have Supabase CLI installed
npm install -g supabase

# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### Option 3: Manual SQL Execution

Connect to your PostgreSQL database and run:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_system_admin
ON public.profiles(is_system_admin)
WHERE is_system_admin = TRUE;

COMMENT ON COLUMN public.profiles.is_system_admin IS
'Identifies Order Friends company administrators who have access to all brands and branches';
```

## Creating a System Administrator

After running the migration, you can promote any user to system admin by updating their profile:

```sql
-- Replace 'user-uuid-here' with the actual user ID from auth.users
UPDATE public.profiles
SET is_system_admin = TRUE
WHERE id = 'user-uuid-here';
```

### Finding User IDs

```sql
-- List all users and their IDs
SELECT
  au.id,
  au.email,
  p.is_system_admin
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ORDER BY au.created_at DESC;
```

## Backend Implementation

### /me Endpoint

The `/me` endpoint now checks for system admin status first before checking other roles:

```typescript
GET /me
Authorization: Bearer <token>

Response for system admin:
{
  "user": {
    "id": "uuid",
    "email": "admin@orderfriends.com",
    "role": "system_admin"
  },
  "memberships": [],
  "ownedBrands": [],
  "isSystemAdmin": true
}
```

### Role Priority

When determining a user's role, the system checks in this order:

1. Is `is_system_admin` true? → Return `system_admin`
2. Does user own any brands? → Return `brand_owner`
3. Is user a branch manager? → Return `branch_manager`
4. Is user staff? → Return `staff`
5. Default → Return `customer`

## Frontend Implementation

### Role-Based Redirect

After login, users are redirected based on their role:

- `system_admin` → `/admin` (full access)
- `brand_owner` → `/admin`
- `branch_manager` → `/admin`
- `staff` → `/admin`
- `customer` → `/customer`

### Access Control

System administrators have access to:

- ✅ All brands and branches
- ✅ All orders, products, and inventory
- ✅ All analytics and reports
- ✅ All administrative functions

## Security Considerations

### Important Notes

1. **Limited Access**: Only grant system admin access to trusted Order Friends employees
2. **Audit Trail**: Consider logging system admin actions for compliance
3. **Regular Review**: Periodically review the list of system admins
4. **Revocation**: To revoke system admin access, simply set `is_system_admin = FALSE`

### Listing System Admins

```sql
SELECT
  au.id,
  au.email,
  au.created_at as user_created,
  p.created_at as profile_created
FROM auth.users au
JOIN public.profiles p ON p.id = au.id
WHERE p.is_system_admin = TRUE
ORDER BY au.created_at DESC;
```

### Revoking System Admin Access

```sql
UPDATE public.profiles
SET is_system_admin = FALSE
WHERE id = 'user-uuid-here';
```

## Testing

### Manual Testing Steps

1. **Create Test Admin**:
   ```sql
   -- Find your test user ID
   SELECT id, email FROM auth.users WHERE email = 'test@example.com';

   -- Promote to system admin
   UPDATE public.profiles
   SET is_system_admin = TRUE
   WHERE id = 'test-user-id';
   ```

2. **Login**: Login with the test admin account

3. **Verify Role**:
   - Call `GET /me` endpoint
   - Confirm response shows `"role": "system_admin"`
   - Confirm `isSystemAdmin: true`

4. **Check Redirect**:
   - After login, should redirect to `/admin`

5. **Verify Access**:
   - Navigate to various admin pages
   - Confirm access to all brands/branches

### Cleanup

```sql
-- Remove test admin access
UPDATE public.profiles
SET is_system_admin = FALSE
WHERE id = 'test-user-id';
```

## API Documentation

### GET /me

Returns user information including role and system admin status.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "system_admin" | "brand_owner" | "branch_manager" | "staff" | "customer"
  },
  "memberships": [...],
  "ownedBrands": [...],
  "isSystemAdmin": boolean
}
```

## Troubleshooting

### System Admin Not Working

1. **Check Migration**: Ensure the migration has been run
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'profiles' AND column_name = 'is_system_admin';
   ```

2. **Check User Profile**: Verify the user has `is_system_admin = TRUE`
   ```sql
   SELECT id, is_system_admin
   FROM public.profiles
   WHERE id = 'user-uuid';
   ```

3. **Check /me Response**: Call the `/me` endpoint and verify the response

4. **Clear Cache**: If using frontend caching, clear the cache

### User Still Shows Old Role

- The user needs to logout and login again
- Or refresh the page to trigger a new `/me` API call

## Future Enhancements

Potential improvements for the system admin feature:

- [ ] Add audit logging for system admin actions
- [ ] Create dedicated `/admin/system` pages for system-level management
- [ ] Add ability to view all brands/branches in a single dashboard
- [ ] Implement system-wide analytics
- [ ] Add user management interface for system admins
- [ ] Create permission granularity within system admin role

---

**Last Updated:** 2026-02-06
**Version:** 1.0.0
