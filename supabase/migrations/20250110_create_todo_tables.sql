-- Migration: Sistema To-Do Completo com Verificação de Permissões
-- Data: 2025-01-10
-- Descrição: Cria tabelas do sistema To-Do e adiciona permissões se necessário

-- Primeiro, adicionar o valor 'viewer' ao enum user_role se não existir
DO $$ 
BEGIN
    -- Verificar se o valor 'viewer' já existe no enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'viewer' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'viewer';
        RAISE NOTICE 'Valor viewer adicionado ao enum user_role';
    ELSE
        RAISE NOTICE 'Valor viewer já existe no enum user_role';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar viewer ao enum: %', SQLERRM;
END $$;

-- Create todo_folders table
CREATE TABLE IF NOT EXISTS public.todo_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create todo_tasks table
CREATE TABLE IF NOT EXISTS public.todo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.todo_folders(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_todo_folders_created_by ON public.todo_folders(created_by);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_folder_id ON public.todo_tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_created_by ON public.todo_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON public.todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON public.todo_tasks(status);

-- Enable RLS
ALTER TABLE public.todo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_tasks ENABLE ROW LEVEL SECURITY;

-- Create update triggers function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_todo_folders_updated_at ON public.todo_folders;
CREATE TRIGGER update_todo_folders_updated_at BEFORE UPDATE ON public.todo_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todo_tasks_updated_at ON public.todo_tasks;
CREATE TRIGGER update_todo_tasks_updated_at BEFORE UPDATE ON public.todo_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICAR E ADICIONAR COLUNAS DE PERMISSÕES SE NÃO EXISTIREM
-- ============================================================================

DO $$ 
BEGIN
    -- can_access_todo: Acesso básico ao sistema To-Do
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_access_todo'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_access_todo BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- can_manage_todo_folders: Criar/editar/deletar pastas
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_manage_todo_folders'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_manage_todo_folders BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- can_manage_todo_tasks: Gerenciar tarefas próprias
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_manage_todo_tasks'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_manage_todo_tasks BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- can_manage_all_todos: Gerenciar todos os to-dos (admin)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_manage_all_todos'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_manage_all_todos BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- can_upload_attachments: Upload de arquivos
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_upload_attachments'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_upload_attachments BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- can_comment_tasks: Comentar em tarefas
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_comment_tasks'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_comment_tasks BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;

    -- can_assign_tasks: Atribuir tarefas a outros usuários
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'can_assign_tasks'
    ) THEN
        ALTER TABLE public.user_permissions 
        ADD COLUMN can_assign_tasks BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar colunas de permissões To-Do: %', SQLERRM;
END $$;

-- ============================================================================
-- CONFIGURAR PERMISSÕES PADRÃO POR NÍVEL DE USUÁRIO
-- ============================================================================

-- Atualizar permissões para usuários MASTER
UPDATE user_permissions 
SET 
    can_access_todo = TRUE,
    can_manage_todo_folders = TRUE,
    can_manage_todo_tasks = TRUE,
    can_manage_all_todos = TRUE,
    can_upload_attachments = TRUE,
    can_comment_tasks = TRUE,
    can_assign_tasks = TRUE
FROM profiles 
WHERE profiles.id = user_permissions.user_id 
AND profiles.role = 'master';

-- Atualizar permissões para usuários ADMIN
UPDATE user_permissions 
SET 
    can_access_todo = TRUE,
    can_manage_todo_folders = TRUE,
    can_manage_todo_tasks = TRUE,
    can_manage_all_todos = TRUE,
    can_upload_attachments = TRUE,
    can_comment_tasks = TRUE,
    can_assign_tasks = TRUE
FROM profiles 
WHERE profiles.id = user_permissions.user_id 
AND profiles.role = 'admin';

-- Atualizar permissões para usuários MANAGER
UPDATE user_permissions 
SET 
    can_access_todo = TRUE,
    can_manage_todo_folders = TRUE,
    can_manage_todo_tasks = TRUE,
    can_manage_all_todos = FALSE,
    can_upload_attachments = TRUE,
    can_comment_tasks = TRUE,
    can_assign_tasks = TRUE
FROM profiles 
WHERE profiles.id = user_permissions.user_id 
AND profiles.role = 'manager';

-- Atualizar permissões para usuários TESTER
UPDATE user_permissions 
SET 
    can_access_todo = TRUE,
    can_manage_todo_folders = FALSE,
    can_manage_todo_tasks = TRUE,
    can_manage_all_todos = FALSE,
    can_upload_attachments = FALSE,
    can_comment_tasks = TRUE,
    can_assign_tasks = FALSE
FROM profiles 
WHERE profiles.id = user_permissions.user_id 
AND profiles.role = 'tester';

-- Atualizar permissões para usuários VIEWER
UPDATE user_permissions 
SET 
    can_access_todo = TRUE,
    can_manage_todo_folders = FALSE,
    can_manage_todo_tasks = FALSE,
    can_manage_all_todos = FALSE,
    can_upload_attachments = FALSE,
    can_comment_tasks = FALSE,
    can_assign_tasks = FALSE
FROM profiles 
WHERE profiles.id = user_permissions.user_id 
AND profiles.role = 'viewer';

-- ============================================================================
-- CRIAR POLÍTICAS RLS PARA TODO_FOLDERS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all folders" ON public.todo_folders;
DROP POLICY IF EXISTS "Users can create folders if they have permission" ON public.todo_folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.todo_folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.todo_folders;

-- Create RLS policies for todo_folders
CREATE POLICY "Users can view all folders" ON public.todo_folders
  FOR SELECT USING (true);

CREATE POLICY "Users can create folders if they have permission" ON public.todo_folders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND can_manage_todo_folders = true
    )
  );

CREATE POLICY "Users can update their own folders" ON public.todo_folders
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND can_manage_all_todos = true
    )
  );

CREATE POLICY "Users can delete their own folders" ON public.todo_folders
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND can_manage_all_todos = true
    )
  );

-- ============================================================================
-- CRIAR POLÍTICAS RLS PARA TODO_TASKS
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all tasks" ON public.todo_tasks;
DROP POLICY IF EXISTS "Users can create tasks if they have permission" ON public.todo_tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.todo_tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.todo_tasks;

-- Create RLS policies for todo_tasks
CREATE POLICY "Users can view all tasks" ON public.todo_tasks
  FOR SELECT USING (true);

CREATE POLICY "Users can create tasks if they have permission" ON public.todo_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND can_manage_todo_tasks = true
    )
  );

CREATE POLICY "Users can update their own tasks" ON public.todo_tasks
  FOR UPDATE USING (
    created_by = auth.uid() OR
    assigned_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND can_manage_all_todos = true
    )
  );

CREATE POLICY "Users can delete their own tasks" ON public.todo_tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid()
      AND can_manage_all_todos = true
    )
  );

-- ============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON COLUMN user_permissions.can_access_todo IS 'Usuário pode acessar o sistema To-Do List';
COMMENT ON COLUMN user_permissions.can_manage_todo_folders IS 'Usuário pode criar, editar e deletar pastas organizacionais';
COMMENT ON COLUMN user_permissions.can_manage_todo_tasks IS 'Usuário pode gerenciar suas próprias tarefas';
COMMENT ON COLUMN user_permissions.can_manage_all_todos IS 'Usuário pode gerenciar tarefas de todos os usuários (admin)';
COMMENT ON COLUMN user_permissions.can_upload_attachments IS 'Usuário pode fazer upload de arquivos anexos às tarefas';
COMMENT ON COLUMN user_permissions.can_comment_tasks IS 'Usuário pode comentar em tarefas';
COMMENT ON COLUMN user_permissions.can_assign_tasks IS 'Usuário pode atribuir tarefas a outros usuários';

-- Log da execução
DO $$ 
BEGIN
    RAISE NOTICE 'Sistema To-Do criado com sucesso - tabelas, permissões e políticas RLS configuradas';
END $$; 