-- Migration: Remover organization_id de profiles e user_permissions e ajustar RLS/RPC
-- Data: 2025-08-29
-- Descrição:
--  - Remove colunas organization_id de profiles e user_permissions
--  - Remove índices e constraints associados
--  - Atualiza políticas RLS de user_permissions para escopo global (sem organização)
--  - Atualiza RPC set_user_permissions para não depender de target_org_id

BEGIN;

-- 1) Remover todas as políticas RLS em user_permissions (defensivo)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT polname FROM pg_policy WHERE polrelid = 'public.user_permissions'::regclass
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_permissions', r.polname);
  END LOOP;
END $$;

-- 2) Remover índice em user_permissions(organization_id), se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_user_permissions_organization_id' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_user_permissions_organization_id';
  END IF;
END $$;

-- 3) Remover índice em profiles(organization_id), se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_profiles_organization_id' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_profiles_organization_id';
  END IF;
END $$;

-- 4) Remover constraint UNIQUE (user_id, organization_id), se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_permissions_user_org_unique'
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_user_org_unique;
  END IF;
END $$;

-- 5) Remover colunas organization_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_permissions' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_permissions DROP COLUMN IF EXISTS organization_id';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles DROP COLUMN IF EXISTS organization_id';
  END IF;
END $$;

-- 6) Recriar políticas RLS sem escopo por organização (globais)
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Visualização: próprio usuário ou master
CREATE POLICY "Users can view own permissions (global)"
  ON public.user_permissions
  FOR SELECT
  USING (
    user_permissions.user_id::uuid = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- Visualização: masters/admins
CREATE POLICY "Masters/admins can view permissions (global)"
  ON public.user_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('master','admin')
    )
  );

-- Inserção: masters/admins
CREATE POLICY "Masters/admins can insert permissions (global)"
  ON public.user_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('master','admin')
    )
  );

-- Atualização: masters/admins
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

-- Exclusão: apenas master
CREATE POLICY "Masters can delete permissions (global)"
  ON public.user_permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'master'
    )
  );

-- 7) Atualizar a RPC set_user_permissions para não depender de organization_id
-- Drop da função antiga com assinatura (uuid, uuid, jsonb)
DROP FUNCTION IF EXISTS public.set_user_permissions(uuid, uuid, jsonb);

-- Nova assinatura: (target_user_id uuid, perms jsonb)
CREATE OR REPLACE FUNCTION public.set_user_permissions(
  target_user_id uuid,
  perms jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_global_master boolean;
  caller_is_admin boolean;
BEGIN
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'master'
  ) INTO caller_is_global_master;

  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) INTO caller_is_admin;

  IF NOT (caller_is_global_master OR caller_is_admin) THEN
    RAISE EXCEPTION 'Only masters or admins can change user permissions';
  END IF;

  -- Tenta atualizar primeiro (não requer índice único)
  UPDATE user_permissions SET
    can_manage_users = COALESCE((perms->>'can_manage_users')::boolean, false),
    can_manage_plans = COALESCE((perms->>'can_manage_plans')::boolean, true),
    can_manage_cases = COALESCE((perms->>'can_manage_cases')::boolean, true),
    can_manage_executions = COALESCE((perms->>'can_manage_executions')::boolean, true),
    can_view_reports = COALESCE((perms->>'can_view_reports')::boolean, true),
    can_use_ai = COALESCE((perms->>'can_use_ai')::boolean, true),
    can_access_model_control = COALESCE((perms->>'can_access_model_control')::boolean, false),
    can_configure_ai_models = COALESCE((perms->>'can_configure_ai_models')::boolean, false),
    can_test_ai_connections = COALESCE((perms->>'can_test_ai_connections')::boolean, false),
    can_manage_ai_templates = COALESCE((perms->>'can_manage_ai_templates')::boolean, false),
    can_select_ai_models = COALESCE((perms->>'can_select_ai_models')::boolean, true)
  WHERE user_id = target_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_permissions (
      user_id,
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
    );
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_permissions(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_permissions(uuid, jsonb) TO authenticated;

-- 8) Atualizar função associate_user_to_organization para não depender das colunas removidas
CREATE OR REPLACE FUNCTION associate_user_to_organization(
    user_uuid UUID, 
    org_uuid UUID, 
    user_role user_role DEFAULT 'viewer',
    member_status VARCHAR DEFAULT 'active'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Inserir/atualizar membro da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (org_uuid, user_uuid, user_role, member_status, 
            CASE WHEN member_status = 'active' THEN NOW() ELSE NULL END)
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at;

    -- Removidas atualizações em profiles.organization_id e user_permissions.organization_id
    RETURN TRUE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao associar usuário à organização (função atualizada): %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

COMMIT;
