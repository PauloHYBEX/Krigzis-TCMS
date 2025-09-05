-- Migration: Update user_permissions RLS to be organization-scoped and add unique constraint
-- Date: 2025-08-13
-- Description:
--  - Scope user_permissions policies by organization via organization_members
--  - Keep a global master override (profiles.role = 'master') if desired
--  - Add UNIQUE (user_id, organization_id) to prevent duplicates per tenant

-- Ensure RLS is enabled (safe to run repeatedly)
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop legacy global policies if they exist
DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Only masters and admins can insert permissions" ON user_permissions;
DROP POLICY IF EXISTS "Only masters and admins can update permissions" ON user_permissions;

-- Add organization-scoped SELECT policies
-- 1) User can view their own permissions within their organizations
CREATE POLICY "Users can view own permissions (scoped)" 
  ON user_permissions
  FOR SELECT
  USING (
    -- Allow user to view their own row when they belong to that organization
    (
      user_permissions.user_id::uuid = auth.uid()
      AND (
        user_permissions.organization_id IS NULL -- legacy safety
        OR EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.user_id = auth.uid()
            AND om.organization_id = user_permissions.organization_id
            AND om.status = 'active'
        )
      )
    )
    OR EXISTS (
      -- Global master override
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- 2) Org masters/admins can view permissions in their org
CREATE POLICY "Org masters/admins can view permissions" 
  ON user_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role IN ('master','admin')
    )
    OR EXISTS (
      -- Global master override
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- INSERT is allowed to org masters/admins for their organization (or global master)
CREATE POLICY "Org masters/admins can insert permissions" 
  ON user_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role IN ('master','admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- UPDATE is allowed to org masters/admins for their organization (or global master)
CREATE POLICY "Org masters/admins can update permissions" 
  ON user_permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role IN ('master','admin')
    )
    OR EXISTS (
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
        AND om.role IN ('master','admin')
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- Optionally allow delete for org masters (and global master). Keep it strict.
CREATE POLICY "Org masters can delete permissions" 
  ON user_permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = user_permissions.organization_id
        AND om.status = 'active'
        AND om.role = 'master'
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- Add a unique constraint to ensure one permissions row per (user, organization)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'user_permissions_user_org_unique'
  ) THEN
    ALTER TABLE user_permissions
    ADD CONSTRAINT user_permissions_user_org_unique UNIQUE (user_id, organization_id);
  END IF;
END $$;

-- Notes:
-- - This migration assumes user_permissions.organization_id is already present (added in 20250115_create_organizations.sql)
-- - Global master override keeps current behavior for superusers while enforcing tenant isolation for others
