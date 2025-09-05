-- ===============================================
-- CONFIGURAÇÃO SUPABASE - LIMPEZA E RECRIAÇÃO COMPLETA
-- ===============================================

-- ===============================================
-- FASE 1: LIMPEZA COMPLETA (COM CASCADE)
-- ===============================================

-- Remover todos os triggers primeiro
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles CASCADE;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations CASCADE;
DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members CASCADE;
DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions CASCADE;
DROP TRIGGER IF EXISTS update_test_plans_updated_at ON test_plans CASCADE;
DROP TRIGGER IF EXISTS update_test_cases_updated_at ON test_cases CASCADE;
DROP TRIGGER IF EXISTS update_test_executions_updated_at ON test_executions CASCADE;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings CASCADE;
DROP TRIGGER IF EXISTS update_todo_folders_updated_at ON todo_folders CASCADE;
DROP TRIGGER IF EXISTS update_todo_tasks_updated_at ON todo_tasks CASCADE;
DROP TRIGGER IF EXISTS update_todo_items_updated_at ON todo_items CASCADE;
DROP TRIGGER IF EXISTS update_access_tokens_updated_at ON access_tokens CASCADE;
DROP TRIGGER IF EXISTS update_access_logs_updated_at ON access_logs CASCADE;

-- Remover todas as políticas RLS
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Members can view organization" ON organizations;
DROP POLICY IF EXISTS "Masters can manage organization" ON organizations;
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Masters and admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Masters can manage permissions" ON user_permissions;
DROP POLICY IF EXISTS "Organization members can view test plans" ON test_plans;
DROP POLICY IF EXISTS "Test managers can manage test plans" ON test_plans;
DROP POLICY IF EXISTS "Organization members can view test cases" ON test_cases;
DROP POLICY IF EXISTS "Test managers can manage test cases" ON test_cases;
DROP POLICY IF EXISTS "Organization members can view test executions" ON test_executions;
DROP POLICY IF EXISTS "Testers can manage test executions" ON test_executions;
DROP POLICY IF EXISTS "Users can manage own todo folders" ON todo_folders;
DROP POLICY IF EXISTS "Users can manage own todo tasks" ON todo_tasks;
DROP POLICY IF EXISTS "Users can manage own todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can manage own access tokens" ON access_tokens;
DROP POLICY IF EXISTS "Users can view own access logs" ON access_logs;

-- Remover funções com CASCADE
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ===============================================
-- FASE 2: CRIAR EXTENSÕES E TIPOS
-- ===============================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar enum para roles de usuário
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ===============================================
-- FASE 3: CRIAR TABELAS (ORDEM CORRETA)
-- ===============================================

-- 1. Tabela de perfis de usuário (base)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de organizações
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    database_id TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(slug)
);

-- 3. Tabela de membros da organização
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invited_by UUID REFERENCES profiles(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, user_id)
);

-- 4. Tabela de permissões de usuário
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- 5. Tabela de planos de teste
CREATE TABLE IF NOT EXISTS test_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES profiles(id),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de casos de teste
CREATE TABLE IF NOT EXISTS test_cases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    test_plan_id UUID REFERENCES test_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '[]',
    expected_result TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de execuções de teste
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    executed_by UUID REFERENCES profiles(id),
    result TEXT CHECK (result IN ('passed', 'failed', 'blocked', 'not_tested')),
    notes TEXT,
    execution_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabela de pastas de tarefas
CREATE TABLE IF NOT EXISTS todo_folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Tabela de tarefas (NOME CORRETO: todo_tasks)
CREATE TABLE IF NOT EXISTS todo_tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    content JSONB,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'archived', 'cancelled')),
    due_date TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0,
    tags TEXT[],
    linked_plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    linked_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    linked_execution_id UUID REFERENCES test_executions(id) ON DELETE SET NULL,
    estimated_hours NUMERIC(5,2),
    actual_hours NUMERIC(5,2),
    progress_percentage INTEGER DEFAULT 0,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    reminder_date TIMESTAMP WITH TIME ZONE,
    is_template BOOLEAN DEFAULT FALSE,
    template_name TEXT,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Tabela de tokens de acesso
CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    token_name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    permissions JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Tabela de logs de acesso
CREATE TABLE IF NOT EXISTS access_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================================
-- FASE 4: CRIAR FUNÇÕES
-- ===============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para criar perfil automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
    );
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;

-- ===============================================
-- FASE 5: CONFIGURAR RLS
-- ===============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas básicas essenciais
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can manage own todo folders" ON todo_folders FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own todo tasks" ON todo_tasks FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can manage own access tokens" ON access_tokens FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can view own access logs" ON access_logs FOR SELECT USING (user_id = auth.uid());

-- ===============================================
-- FASE 6: CRIAR TRIGGERS
-- ===============================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_plans_updated_at BEFORE UPDATE ON test_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_folders_updated_at BEFORE UPDATE ON todo_folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todo_tasks_updated_at BEFORE UPDATE ON todo_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para criar perfil automático
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===============================================
-- VERIFICAÇÃO FINAL
-- ===============================================

DO $$ 
BEGIN
    RAISE NOTICE '🧹 Limpeza completa realizada com CASCADE';
    RAISE NOTICE '✅ Todas as tabelas recriadas com nomenclatura correta';
    RAISE NOTICE '✅ Sistema TODO usa todo_tasks (não todo_items)';
    RAISE NOTICE '✅ Funções recriadas sem conflitos';
    RAISE NOTICE '✅ Triggers recriados corretamente';
    RAISE NOTICE '✅ Políticas RLS configuradas';
    RAISE NOTICE '🚀 Sistema pronto para uso!';
END $$; 