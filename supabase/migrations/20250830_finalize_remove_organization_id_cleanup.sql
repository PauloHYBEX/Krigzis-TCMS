-- Migration: Finalize cleanup removing residual organization_id dependencies
-- Date: 2025-08-30
-- Description:
--  - Defensive cleanup to ensure no remaining dependencies on organization_id
--  - Drops lingering policies, indexes, constraints, and columns if they still exist
--  - Ensures RPC and helper functions are in the updated (global) form

BEGIN;
 SET CONSTRAINTS ALL DEFERRED;

-- 1) Drop any remaining RLS policies on user_permissions (defensive)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT polname FROM pg_policy WHERE polrelid = 'public.user_permissions'::regclass
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_permissions', r.polname);
  END LOOP;
END $$;

-- 2) Drop older RPC with org parameter if it still exists
DROP FUNCTION IF EXISTS public.set_user_permissions(uuid, uuid, jsonb);

-- 3) Ensure UNIQUE(user_id, organization_id) is dropped (legacy)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_permissions_user_org_unique'
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_user_org_unique;
  END IF;
END $$;

-- 4) Drop legacy indexes on organization_id (defensive)
DROP INDEX IF EXISTS public.idx_profiles_organization_id;
DROP INDEX IF EXISTS public.idx_user_permissions_organization_id;
DROP INDEX IF EXISTS public.idx_test_plans_organization_id;
DROP INDEX IF EXISTS public.idx_test_cases_organization_id;
DROP INDEX IF EXISTS public.idx_test_executions_organization_id;

-- 5) Drop organization_id columns if any still remain (defensive)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles DROP COLUMN IF EXISTS organization_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_permissions' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_permissions DROP COLUMN IF EXISTS organization_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'test_plans' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_plans DROP COLUMN IF EXISTS organization_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'test_cases' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_cases DROP COLUMN IF EXISTS organization_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'test_executions' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_executions DROP COLUMN IF EXISTS organization_id';
  END IF;
END $$;

-- 6) Recreate global RLS policies on user_permissions (post-cleanup)
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions (global)"
  ON public.user_permissions
  FOR SELECT
  USING (
    user_permissions.user_id::uuid = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

CREATE POLICY "Masters/admins can view permissions (global)"
  ON public.user_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('master','admin')
    )
  );

CREATE POLICY "Masters/admins can insert permissions (global)"
  ON public.user_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('master','admin')
    )
  );

CREATE POLICY "Masters/admins can update permissions (global)"
  ON public.user_permissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('master','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('master','admin')
    )
  );

CREATE POLICY "Masters can delete permissions (global)"
  ON public.user_permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- 7) Ensure updated associate_user_to_organization function (no writes to removed columns)
CREATE OR REPLACE FUNCTION associate_user_to_organization(
    user_uuid UUID,
    org_uuid UUID,
    user_role user_role DEFAULT 'viewer',
    member_status VARCHAR DEFAULT 'active'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Upsert membership only; do not touch profiles.organization_id or user_permissions.organization_id
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (org_uuid, user_uuid, user_role, member_status,
            CASE WHEN member_status = 'active' THEN NOW() ELSE NULL END)
    ON CONFLICT (organization_id, user_id)
    DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at;

    RETURN TRUE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao associar usuário à organização (função finalizada): %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
