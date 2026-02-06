-- Create unified members VIEW from branch_members table
-- This VIEW standardizes role names and provides a consistent interface
-- for querying user memberships across the application

BEGIN;

-- Drop the view if it already exists (for rerunning the migration)
DROP VIEW IF EXISTS public.members;

-- Create the members view
CREATE VIEW public.members AS
SELECT
  bm.id,
  bm.user_id,
  bm.branch_id,
  bm.status,
  bm.created_at,
  -- Standardize role names to match application logic
  CASE
    WHEN bm.role = 'BRANCH_ADMIN' THEN 'branch_manager'
    WHEN bm.role = 'STAFF' THEN 'staff'
    WHEN bm.role = 'BRANCH_OWNER' THEN 'branch_owner'
    WHEN bm.role = 'VIEWER' THEN 'viewer'
    ELSE 'staff'  -- Default fallback
  END::text as role
FROM public.branch_members bm;

-- Add comment for documentation
COMMENT ON VIEW public.members IS
'Unified view of user memberships with standardized role names. Maps branch_members roles to application-level role names for consistency.';

-- Grant appropriate permissions
-- (Adjust based on your RLS policies and user roles)
GRANT SELECT ON public.members TO authenticated;
GRANT SELECT ON public.members TO anon;

COMMIT;
