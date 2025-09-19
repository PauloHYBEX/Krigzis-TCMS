-- Function roles, role requests, and profile tags

-- 1) Enum for function roles (stack)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'function_role') THEN
    CREATE TYPE function_role AS ENUM ('desenvolvimento','suporte','gerencia','supervisao','visualizador');
  END IF;
END $$;

-- 2) Junction table: profile_function_roles (multi-roles per user)
CREATE TABLE IF NOT EXISTS public.profile_function_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role function_role NOT NULL,
  icon TEXT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID NULL REFERENCES auth.users(id),
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.profile_function_roles ENABLE ROW LEVEL SECURITY;

-- Select: any authenticated user can read (para exibir no perfil)
DROP POLICY IF EXISTS pfr_select ON public.profile_function_roles;
CREATE POLICY pfr_select ON public.profile_function_roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert/Update/Delete: only masters/admins
DROP POLICY IF EXISTS pfr_write ON public.profile_function_roles;
CREATE POLICY pfr_write ON public.profile_function_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
    )
  );

-- 3) Tags no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4) Role requests: apenas uma por usuário (apenas 1 vez)
CREATE TABLE IF NOT EXISTS public.role_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_roles function_role[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID NULL REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_requests_user ON public.role_requests(user_id);

ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;

-- Select: o próprio usuário vê sua solicitação; masters/admins veem todas
DROP POLICY IF EXISTS rr_select ON public.role_requests;
CREATE POLICY rr_select ON public.role_requests
  FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
    )
  );

-- Insert: apenas o próprio usuário e somente se não possuir registro ainda (garantido pelo unique index)
DROP POLICY IF EXISTS rr_insert ON public.role_requests;
CREATE POLICY rr_insert ON public.role_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update: somente masters/admins podem aprovar/rejeitar
DROP POLICY IF EXISTS rr_update ON public.role_requests;
CREATE POLICY rr_update ON public.role_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
    )
  );
