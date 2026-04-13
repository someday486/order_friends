-- Add system_admin role to profiles table
-- This allows Order Friends company administrators to be identified

BEGIN;

-- Add is_system_admin column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Create an index for faster lookup
CREATE INDEX IF NOT EXISTS idx_profiles_is_system_admin
ON public.profiles(is_system_admin)
WHERE is_system_admin = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_system_admin IS
'Identifies Order Friends company administrators who have access to all brands and branches';

COMMIT;
