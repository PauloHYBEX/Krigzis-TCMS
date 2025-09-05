-- Fase 2: Suporte a Perfil (viewer), Notificações, Preferências e Histórico

-- Garantir função utilitária para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Adicionar valor 'viewer' ao enum user_role (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'viewer'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'viewer';
  END IF;
END$$;

-- Ajustar default da coluna role em profiles para 'viewer'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'viewer';
  END IF;
END $$;

-- Atualizar registros sem role definido (se houver)
UPDATE public.profiles SET role = 'viewer' WHERE role IS NULL;

-- Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para notifications
-- Select: dono ou admin/master
CREATE POLICY IF NOT EXISTS "notifications_select_owner_or_admin" ON public.notifications
FOR SELECT
USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- Insert: o próprio usuário (auto-registro) ou admin/master
CREATE POLICY IF NOT EXISTS "notifications_insert_owner_or_admin" ON public.notifications
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- Update: apenas dono pode marcar como lida; admin/master também
CREATE POLICY IF NOT EXISTS "notifications_update_owner_or_admin" ON public.notifications
FOR UPDATE
USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- Delete: admin/master
CREATE POLICY IF NOT EXISTS "notifications_delete_admin" ON public.notifications
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- Preferências de Notificação
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  system_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS: dono pode gerenciar; admin/master pode ler
CREATE POLICY IF NOT EXISTS "notif_prefs_select_owner_or_admin" ON public.notification_preferences
FOR SELECT
USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

CREATE POLICY IF NOT EXISTS "notif_prefs_upsert_owner" ON public.notification_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "notif_prefs_update_owner" ON public.notification_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "notif_prefs_delete_owner" ON public.notification_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_notif_prefs_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notif_prefs_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir preferências padrão para usuários existentes
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Histórico de atividades
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  context TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS: dono pode ver; admin/master pode ver; inserção pelo próprio usuário permitida
CREATE POLICY IF NOT EXISTS "activity_logs_select_owner_or_admin" ON public.activity_logs
FOR SELECT
USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

CREATE POLICY IF NOT EXISTS "activity_logs_insert_owner_or_admin" ON public.activity_logs
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs (user_id, created_at DESC);

-- Comentários
COMMENT ON TABLE public.notifications IS 'Notificações por usuário';
COMMENT ON TABLE public.notification_preferences IS 'Preferências de notificação por usuário';
COMMENT ON TABLE public.activity_logs IS 'Histórico de atividades do usuário';
