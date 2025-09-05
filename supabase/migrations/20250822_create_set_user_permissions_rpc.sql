-- Migration: Create secure RPC to set a user's permissions
-- Date: 2025-08-22
-- Description:
--  - Adds function set_user_permissions(target_user_id uuid, target_org_id uuid, perms jsonb)
--  - Only organization masters (or global master) can change permissions
--  - Upserts into user_permissions respecting RLS and tenant scoping

CREATE OR REPLACE FUNCTION public.set_user_permissions(
  target_user_id uuid,
  target_org_id uuid,
  perms jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_global_master boolean;
  caller_is_org_master boolean;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check caller master privileges
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'master'
  ) INTO caller_is_global_master;

  IF target_org_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = target_org_id
        AND om.status = 'active'
        AND om.role = 'master'
    ) INTO caller_is_org_master;
  ELSE
    caller_is_org_master := false;
  END IF;

  IF NOT (caller_is_global_master OR caller_is_org_master) THEN
    RAISE EXCEPTION 'Only masters can change user permissions';
  END IF;

  -- Upsert permissions row
  INSERT INTO user_permissions (
    user_id,
    organization_id,
    can_manage_users,
    can_manage_plans,
    can_manage_cases,
    can_manage_executions,
    can_view_reports,
    can_use_ai,
    can_access_model_control,
    can_configure_ai_models,
    can_test_ai_connections,
    can_manage_ai_templates,
    can_select_ai_models
  ) VALUES (
    target_user_id,
    target_org_id,
    COALESCE((perms->>'can_manage_users')::boolean, false),
    COALESCE((perms->>'can_manage_plans')::boolean, true),
    COALESCE((perms->>'can_manage_cases')::boolean, true),
    COALESCE((perms->>'can_manage_executions')::boolean, true),
    COALESCE((perms->>'can_view_reports')::boolean, true),
    COALESCE((perms->>'can_use_ai')::boolean, true),
    COALESCE((perms->>'can_access_model_control')::boolean, false),
    COALESCE((perms->>'can_configure_ai_models')::boolean, false),
    COALESCE((perms->>'can_test_ai_connections')::boolean, false),
    COALESCE((perms->>'can_manage_ai_templates')::boolean, false),
    COALESCE((perms->>'can_select_ai_models')::boolean, true)
  )
  ON CONFLICT (user_id, organization_id)
  DO UPDATE SET
    can_manage_users = EXCLUDED.can_manage_users,
    can_manage_plans = EXCLUDED.can_manage_plans,
    can_manage_cases = EXCLUDED.can_manage_cases,
    can_manage_executions = EXCLUDED.can_manage_executions,
    can_view_reports = EXCLUDED.can_view_reports,
    can_use_ai = EXCLUDED.can_use_ai,
    can_access_model_control = EXCLUDED.can_access_model_control,
    can_configure_ai_models = EXCLUDED.can_configure_ai_models,
    can_test_ai_connections = EXCLUDED.can_test_ai_connections,
    can_manage_ai_templates = EXCLUDED.can_manage_ai_templates,
    can_select_ai_models = EXCLUDED.can_select_ai_models;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_permissions(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_permissions(uuid, uuid, jsonb) TO authenticated;

-- Notes:
-- - Assumes user_permissions has a unique constraint on (user_id, organization_id)
-- - RLS on user_permissions already restricts writes to masters; SECURITY DEFINER centralizes checks
