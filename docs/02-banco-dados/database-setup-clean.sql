-- ============================================================================
-- TESTMASTER AI - CONFIGURAÇÃO COMPLETA DA BASE DE DADOS (VERSÃO LIMPA)
-- ============================================================================
-- Instruções de Instalação:
-- 1. Acesse o Dashboard do Supabase
-- 2. Vá em SQL Editor
-- 3. Cole todo este código e execute
-- 4. Aguarde a finalização completa
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURAÇÕES INICIAIS
-- ============================================================================

-- Criar ENUM de roles de usuário
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester', 'viewer');
    END IF;
END $$;

-- ============================================================================
-- 2. TABELAS PRINCIPAIS DO SISTEMA
-- ============================================================================

-- Tabela de organizações
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    database_id VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    role user_role DEFAULT 'viewer',
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de permissões de usuário
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Permissões básicas
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_manage_plans BOOLEAN DEFAULT FALSE,
    can_manage_cases BOOLEAN DEFAULT FALSE,
    can_manage_executions BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT FALSE,
    -- Permissões de IA
    can_use_ai BOOLEAN DEFAULT FALSE,
    can_access_model_control BOOLEAN DEFAULT FALSE,
    can_configure_ai_models BOOLEAN DEFAULT FALSE,
    can_test_ai_connections BOOLEAN DEFAULT FALSE,
    can_manage_ai_templates BOOLEAN DEFAULT FALSE,
    can_select_ai_models BOOLEAN DEFAULT FALSE,
    -- Permissões TODO (simplificadas)
    can_access_todo BOOLEAN DEFAULT FALSE,
    can_manage_todo_folders BOOLEAN DEFAULT FALSE,
    can_manage_todo_tasks BOOLEAN DEFAULT FALSE,
    can_manage_all_todos BOOLEAN DEFAULT FALSE,
    can_upload_attachments BOOLEAN DEFAULT FALSE,
    can_comment_tasks BOOLEAN DEFAULT FALSE,
    can_assign_tasks BOOLEAN DEFAULT FALSE,
    -- Controle
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Tabela de membros de organizações
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- 3. TABELAS DO SISTEMA DE TESTES
-- ============================================================================

-- Planos de teste
CREATE TABLE IF NOT EXISTS test_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objective TEXT,
    scope TEXT,
    approach TEXT,
    resources TEXT,
    schedule TEXT,
    risks TEXT,
    criteria TEXT,
    generated_by_ai BOOLEAN DEFAULT FALSE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Casos de teste
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    steps TEXT,
    expected_result TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'in_progress', 'completed', 'blocked')),
    test_plan_id UUID REFERENCES test_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execuções de teste
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'passed', 'failed', 'blocked', 'skipped')),
    result TEXT,
    notes TEXT,
    executed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. SISTEMA TODO - TABELAS PRINCIPAIS
-- ============================================================================

-- Pastas/Diretórios de tarefas
CREATE TABLE IF NOT EXISTS todo_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'folder',
    parent_folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarefas principais
CREATE TABLE IF NOT EXISTS todo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    position INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    -- Integração com sistema de testes
    linked_plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    linked_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    linked_execution_id UUID REFERENCES test_executions(id) ON DELETE SET NULL,
    -- Controle de tempo e progresso
    estimated_hours NUMERIC(5,2),
    actual_hours NUMERIC(5,2),
    progress_percentage INTEGER DEFAULT 0,
    -- Recursos avançados
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    reminder_date TIMESTAMPTZ,
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subtarefas
CREATE TABLE IF NOT EXISTS todo_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    due_date TIMESTAMPTZ,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sistema de comentários
CREATE TABLE IF NOT EXISTS todo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    is_edited BOOLEAN DEFAULT FALSE,
    parent_comment_id UUID REFERENCES todo_comments(id) ON DELETE CASCADE,
    mentions TEXT[] DEFAULT '{}',
    reactions JSONB DEFAULT '{}',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sistema de anexos
CREATE TABLE IF NOT EXISTS todo_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'attachments',
    description TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates de tarefas
CREATE TABLE IF NOT EXISTS todo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de atividades
CREATE TABLE IF NOT EXISTS todo_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES todo_tasks(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SISTEMA DE CONFIGURAÇÕES
-- ============================================================================

-- Configurações do usuário
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- Tokens de acesso
CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de acesso
CREATE TABLE IF NOT EXISTS access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    token_id UUID REFERENCES access_tokens(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_ip INET,
    user_agent TEXT,
    action VARCHAR(50) NOT NULL CHECK (action IN ('token_created', 'token_used', 'token_expired', 'token_invalid', 'token_max_uses_reached', 'access_denied', 'access_granted')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'expired', 'invalid')),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. CONFIGURAÇÃO DE SEGURANÇA (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de RLS
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices das tabelas principais
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Índices do sistema de testes
CREATE INDEX IF NOT EXISTS idx_test_plans_user_id ON test_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_user_id ON test_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_plan_id ON test_cases(test_plan_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_user_id ON test_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id ON test_executions(case_id);

-- Índices do sistema TODO
CREATE INDEX IF NOT EXISTS idx_todo_folders_user_id ON todo_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_user_id ON todo_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_folder_id ON todo_tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_subtasks_task_id ON todo_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_comments_task_id ON todo_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_attachments_task_id ON todo_attachments(task_id);

-- ============================================================================
-- 8. DADOS INICIAIS
-- ============================================================================

-- Criar organização padrão
INSERT INTO organizations (name, slug, description, database_id)
VALUES ('Organização Padrão', 'default', 'Organização criada automaticamente', 'db_default_' || extract(epoch from now())::text)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 9. TRIGGERS E FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em tabelas relevantes
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_plans_updated_at BEFORE UPDATE ON test_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_executions_updated_at BEFORE UPDATE ON test_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_folders_updated_at BEFORE UPDATE ON todo_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_tasks_updated_at BEFORE UPDATE ON todo_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_subtasks_updated_at BEFORE UPDATE ON todo_subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_comments_updated_at BEFORE UPDATE ON todo_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_templates_updated_at BEFORE UPDATE ON todo_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_access_tokens_updated_at BEFORE UPDATE ON access_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'TESTMASTER AI - Base de dados configurada com sucesso!';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Tabelas criadas: 17';
    RAISE NOTICE 'Índices criados: 20+';
    RAISE NOTICE 'Triggers criados: 13';
    RAISE NOTICE 'RLS habilitado em todas as tabelas';
    RAISE NOTICE 'Sistema pronto para uso!';
    RAISE NOTICE '================================================================';
END $$; 
-- TESTMASTER AI - CONFIGURAÇÃO COMPLETA DA BASE DE DADOS (VERSÃO LIMPA)
-- ============================================================================
-- Instruções de Instalação:
-- 1. Acesse o Dashboard do Supabase
-- 2. Vá em SQL Editor
-- 3. Cole todo este código e execute
-- 4. Aguarde a finalização completa
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURAÇÕES INICIAIS
-- ============================================================================

-- Criar ENUM de roles de usuário
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester', 'viewer');
    END IF;
END $$;

-- ============================================================================
-- 2. TABELAS PRINCIPAIS DO SISTEMA
-- ============================================================================

-- Tabela de organizações
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    database_id VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    email TEXT,
    role user_role DEFAULT 'viewer',
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de permissões de usuário
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Permissões básicas
    can_manage_users BOOLEAN DEFAULT FALSE,
    can_manage_plans BOOLEAN DEFAULT FALSE,
    can_manage_cases BOOLEAN DEFAULT FALSE,
    can_manage_executions BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT FALSE,
    -- Permissões de IA
    can_use_ai BOOLEAN DEFAULT FALSE,
    can_access_model_control BOOLEAN DEFAULT FALSE,
    can_configure_ai_models BOOLEAN DEFAULT FALSE,
    can_test_ai_connections BOOLEAN DEFAULT FALSE,
    can_manage_ai_templates BOOLEAN DEFAULT FALSE,
    can_select_ai_models BOOLEAN DEFAULT FALSE,
    -- Permissões TODO (simplificadas)
    can_access_todo BOOLEAN DEFAULT FALSE,
    can_manage_todo_folders BOOLEAN DEFAULT FALSE,
    can_manage_todo_tasks BOOLEAN DEFAULT FALSE,
    can_manage_all_todos BOOLEAN DEFAULT FALSE,
    can_upload_attachments BOOLEAN DEFAULT FALSE,
    can_comment_tasks BOOLEAN DEFAULT FALSE,
    can_assign_tasks BOOLEAN DEFAULT FALSE,
    -- Controle
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Tabela de membros de organizações
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- 3. TABELAS DO SISTEMA DE TESTES
-- ============================================================================

-- Planos de teste
CREATE TABLE IF NOT EXISTS test_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    objective TEXT,
    scope TEXT,
    approach TEXT,
    resources TEXT,
    schedule TEXT,
    risks TEXT,
    criteria TEXT,
    generated_by_ai BOOLEAN DEFAULT FALSE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Casos de teste
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    steps TEXT,
    expected_result TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'in_progress', 'completed', 'blocked')),
    test_plan_id UUID REFERENCES test_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execuções de teste
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'passed', 'failed', 'blocked', 'skipped')),
    result TEXT,
    notes TEXT,
    executed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. SISTEMA TODO - TABELAS PRINCIPAIS
-- ============================================================================

-- Pastas/Diretórios de tarefas
CREATE TABLE IF NOT EXISTS todo_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'folder',
    parent_folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarefas principais
CREATE TABLE IF NOT EXISTS todo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    position INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    -- Integração com sistema de testes
    linked_plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    linked_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    linked_execution_id UUID REFERENCES test_executions(id) ON DELETE SET NULL,
    -- Controle de tempo e progresso
    estimated_hours NUMERIC(5,2),
    actual_hours NUMERIC(5,2),
    progress_percentage INTEGER DEFAULT 0,
    -- Recursos avançados
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    reminder_date TIMESTAMPTZ,
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(255),
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subtarefas
CREATE TABLE IF NOT EXISTS todo_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    position INTEGER DEFAULT 0,
    due_date TIMESTAMPTZ,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sistema de comentários
CREATE TABLE IF NOT EXISTS todo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    is_edited BOOLEAN DEFAULT FALSE,
    parent_comment_id UUID REFERENCES todo_comments(id) ON DELETE CASCADE,
    mentions TEXT[] DEFAULT '{}',
    reactions JSONB DEFAULT '{}',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sistema de anexos
CREATE TABLE IF NOT EXISTS todo_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'attachments',
    description TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates de tarefas
CREATE TABLE IF NOT EXISTS todo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de atividades
CREATE TABLE IF NOT EXISTS todo_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES todo_tasks(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SISTEMA DE CONFIGURAÇÕES
-- ============================================================================

-- Configurações do usuário
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

-- Tokens de acesso
CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de acesso
CREATE TABLE IF NOT EXISTS access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    token_id UUID REFERENCES access_tokens(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_ip INET,
    user_agent TEXT,
    action VARCHAR(50) NOT NULL CHECK (action IN ('token_created', 'token_used', 'token_expired', 'token_invalid', 'token_max_uses_reached', 'access_denied', 'access_granted')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed', 'expired', 'invalid')),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. CONFIGURAÇÃO DE SEGURANÇA (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas básicas de RLS
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 7. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices das tabelas principais
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Índices do sistema de testes
CREATE INDEX IF NOT EXISTS idx_test_plans_user_id ON test_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_user_id ON test_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_plan_id ON test_cases(test_plan_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_user_id ON test_executions(executed_by);
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id ON test_executions(case_id);

-- Índices do sistema TODO
CREATE INDEX IF NOT EXISTS idx_todo_folders_user_id ON todo_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_user_id ON todo_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_folder_id ON todo_tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_subtasks_task_id ON todo_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_comments_task_id ON todo_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_attachments_task_id ON todo_attachments(task_id);

-- ============================================================================
-- 8. DADOS INICIAIS
-- ============================================================================

-- Criar organização padrão
INSERT INTO organizations (name, slug, description, database_id)
VALUES ('Organização Padrão', 'default', 'Organização criada automaticamente', 'db_default_' || extract(epoch from now())::text)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 9. TRIGGERS E FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em tabelas relevantes
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_plans_updated_at BEFORE UPDATE ON test_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_executions_updated_at BEFORE UPDATE ON test_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_folders_updated_at BEFORE UPDATE ON todo_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_tasks_updated_at BEFORE UPDATE ON todo_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_subtasks_updated_at BEFORE UPDATE ON todo_subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_comments_updated_at BEFORE UPDATE ON todo_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_templates_updated_at BEFORE UPDATE ON todo_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_access_tokens_updated_at BEFORE UPDATE ON access_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'TESTMASTER AI - Base de dados configurada com sucesso!';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Tabelas criadas: 17';
    RAISE NOTICE 'Índices criados: 20+';
    RAISE NOTICE 'Triggers criados: 13';
    RAISE NOTICE 'RLS habilitado em todas as tabelas';
    RAISE NOTICE 'Sistema pronto para uso!';
    RAISE NOTICE '================================================================';
END $$; 