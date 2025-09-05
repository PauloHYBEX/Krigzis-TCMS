-- Migration: Create secure RPC to set a user's role
-- Date: 2025-08-22
-- Description:
--  - Adds function set_user_role(target_user_id uuid, target_role user_role, target_org_id uuid)
--  - Only organization masters (or global master) can change roles
--  - Prevents self-demotion

-- Create or replace function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user_id uuid,
  target_role user_role,
  target_org_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_global_master boolean;
  caller_is_org_master boolean;
BEGIN
  -- Validate input
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'target_role is required';
  END IF;

  -- Who is calling
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check caller master privileges
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'master'
  ) INTO caller_is_global_master;

  SELECT EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = target_org_id
      AND om.status = 'active'
      AND om.role = 'master'
  ) INTO caller_is_org_master;

  IF NOT (caller_is_global_master OR caller_is_org_master) THEN
    RAISE EXCEPTION 'Only masters can change user roles';
  END IF;

  -- Safety: do not let users demote themselves
  IF target_user_id = auth.uid() AND target_role <> 'master' THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  -- Update org-specific role (upsert membership if needed)
  IF target_org_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (target_org_id, target_user_id, target_role, 'active', NOW())
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET role = EXCLUDED.role,
                  status = EXCLUDED.status,
                  accepted_at = COALESCE(organization_members.accepted_at, EXCLUDED.accepted_at);
  END IF;

  -- Update global profile role (kept for current app usage)
  UPDATE profiles
  SET role = target_role,
      updated_at = NOW()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- Permissions: allow authenticated users to call; checks inside function enforce master-only
REVOKE ALL ON FUNCTION public.set_user_role(uuid, user_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, user_role, uuid) TO authenticated;

-- Notes:
-- - Function performs internal checks using auth.uid() and current tables
-- - It updates both organization_members (scoped) and profiles (global) to keep UI consistent
