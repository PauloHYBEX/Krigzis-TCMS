-- Migration: Restrict INSERT/UPDATE on user_permissions to masters only
-- Date: 2025-08-22
-- Description:
--  - Drop policies that allow admins to INSERT/UPDATE
--  - Create new policies so only org masters (and global master) can INSERT/UPDATE
--  - Keep existing SELECT policies unchanged

-- Ensure RLS is enabled (safe to run repeatedly)
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop previous admin-enabled write policies if they exist
DROP POLICY IF EXISTS "Org masters/admins can insert permissions" ON user_permissions;
DROP POLICY IF EXISTS "Org masters/admins can update permissions" ON user_permissions;

-- Create new INSERT policy for org masters (and global master override)
CREATE POLICY "Org masters can insert permissions"
  ON user_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role = 'master'
    )
    OR EXISTS (
      -- Global master override
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- Create new UPDATE policy for org masters (and global master override)
CREATE POLICY "Org masters can update permissions"
  ON user_permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role = 'master'
    )
    OR EXISTS (
      -- Global master override
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role = 'master'
    )
    OR EXISTS (
      -- Global master override
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- Notes:
-- - SELECT policies remain as defined in 20250813_update_user_permissions_rls.sql
-- - DELETE policy (masters only) remains unchanged
