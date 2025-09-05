-- Migration: Adicionar Permissões do Sistema To-Do
-- Data: 2025-01-02
-- Descrição: Adiciona as novas permissões do sistema To-Do à tabela user_permissions

-- ============================================================================
-- ADICIONAR COLUNAS DE PERMISSÕES TO-DO
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
    RAISE NOTICE 'Permissões do sistema To-Do adicionadas com sucesso às user_permissions';
END $$; 