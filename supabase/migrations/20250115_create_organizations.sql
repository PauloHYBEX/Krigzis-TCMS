-- Migration: Sistema de Organizações/Tenants
-- Data: 2025-01-15
-- Descrição: Implementa sistema multi-tenant com organizações isoladas

-- ============================================================================
-- 1. TABELA: organizations (Organizações/Tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    database_id VARCHAR(100) UNIQUE NOT NULL, -- ID único da base de dados
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_database_id ON organizations(database_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);

-- ============================================================================
-- 2. TABELA: organization_members (Membros das organizações)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Garantir que um usuário só pode ter um papel por organização
    UNIQUE(organization_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- ============================================================================
-- 3. ADICIONAR organization_id às tabelas existentes
-- ============================================================================

-- Adicionar organization_id à tabela profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela profiles';
    ELSE
        RAISE NOTICE 'Coluna organization_id já existe na tabela profiles';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em profiles: %', SQLERRM;
END $$;

-- Adicionar organization_id à tabela user_permissions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE user_permissions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_user_permissions_organization_id ON user_permissions(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela user_permissions';
    ELSE
        RAISE NOTICE 'Coluna organization_id já existe na tabela user_permissions';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em user_permissions: %', SQLERRM;
END $$;

-- Adicionar organization_id às tabelas de teste
DO $$ 
BEGIN
    -- test_plans
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_plans' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_plans 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_plans_organization_id ON test_plans(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_plans';
    END IF;

    -- test_cases
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_cases' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_cases 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_cases_organization_id ON test_cases(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_cases';
    END IF;

    -- test_executions
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_executions' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_executions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_executions_organization_id ON test_executions(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_executions';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id nas tabelas de teste: %', SQLERRM;
END $$;

-- Adicionar organization_id às tabelas do To-Do
DO $$ 
BEGIN
    -- todo_folders
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_folders' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_folders 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_folders_organization_id ON todo_folders(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_folders';
    END IF;

    -- todo_tasks
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_tasks' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_tasks 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_tasks_organization_id ON todo_tasks(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_tasks';
    END IF;

    -- todo_subtasks
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_subtasks' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_subtasks 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_subtasks_organization_id ON todo_subtasks(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_subtasks';
    END IF;

    -- todo_attachments
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_attachments' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_attachments 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_attachments_organization_id ON todo_attachments(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_attachments';
    END IF;

    -- todo_comments
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_comments' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_comments 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_comments_organization_id ON todo_comments(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_comments';
    END IF;

    -- todo_activity_log
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_activity_log' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_activity_log 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_activity_log_organization_id ON todo_activity_log(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_activity_log';
    END IF;

    -- todo_templates
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_templates' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_templates 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_templates_organization_id ON todo_templates(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_templates';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id nas tabelas do To-Do: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para gerar ID único de base de dados
CREATE OR REPLACE FUNCTION generate_database_id()
RETURNS VARCHAR AS $$
DECLARE
    db_id VARCHAR;
BEGIN
    -- Gerar ID único baseado em timestamp + random
    db_id := 'db_' || to_char(now(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    RETURN db_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar organização padrão
CREATE OR REPLACE FUNCTION create_default_organization(org_name VARCHAR, org_slug VARCHAR)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
    db_id VARCHAR;
BEGIN
    -- Gerar ID único da base de dados
    db_id := generate_database_id();
    
    -- Criar organização
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES (org_name, org_slug, 'Organização criada automaticamente', db_id)
    RETURNING id INTO org_id;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- Função para associar usuário a uma organização
CREATE OR REPLACE FUNCTION associate_user_to_organization(
    user_uuid UUID, 
    org_uuid UUID, 
    user_role user_role DEFAULT 'viewer',
    member_status VARCHAR DEFAULT 'active'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Inserir membro da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (org_uuid, user_uuid, user_role, member_status, 
            CASE WHEN member_status = 'active' THEN NOW() ELSE NULL END)
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at;
    
    -- Atualizar perfil do usuário
    UPDATE profiles 
    SET organization_id = org_uuid
    WHERE id = user_uuid;
    
    -- Atualizar permissões do usuário
    UPDATE user_permissions 
    SET organization_id = org_uuid
    WHERE user_id = user_uuid;
    
    RETURN TRUE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao associar usuário à organização: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Políticas para organizations
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Organization masters can manage their organization" ON organizations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
            AND role = 'master'
        )
    );

-- Políticas para organization_members
CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid()
        )
    );

CREATE POLICY "Organization masters can manage members" ON organization_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid()
            AND om2.role = 'master'
        )
    );

-- ============================================================================
-- 6. CRIAR ORGANIZAÇÃO PADRÃO PARA DADOS EXISTENTES
-- ============================================================================

DO $$
DECLARE
    default_org_id UUID;
    default_db_id VARCHAR;
BEGIN
    -- Criar organização padrão para dados existentes
    default_db_id := generate_database_id();
    
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES ('Organização Padrão', 'default', 'Organização padrão para dados existentes', default_db_id)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO default_org_id;
    
    -- Se não conseguiu inserir (já existe), buscar o ID
    IF default_org_id IS NULL THEN
        SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
    END IF;
    
    -- Associar todos os usuários existentes à organização padrão
    UPDATE profiles 
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    UPDATE user_permissions 
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    -- Associar usuários como membros da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    SELECT default_org_id, id, role, 'active', NOW()
    FROM profiles
    WHERE organization_id = default_org_id
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Organização padrão criada e usuários associados';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao criar organização padrão: %', SQLERRM;
END $$;

-- ============================================================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE organizations IS 'Organizações/Tenants do sistema multi-tenant';
COMMENT ON TABLE organization_members IS 'Membros das organizações com seus papéis';
COMMENT ON COLUMN organizations.database_id IS 'ID único da base de dados para identificação';
COMMENT ON COLUMN organization_members.status IS 'Status do membro: pending, active, suspended';
COMMENT ON COLUMN organization_members.role IS 'Papel do usuário na organização';

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Sistema de organizações criado com sucesso - multi-tenant implementado';
END $$;

-- Data: 2025-01-15
-- Descrição: Implementa sistema multi-tenant com organizações isoladas

-- ============================================================================
-- 1. TABELA: organizations (Organizações/Tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    database_id VARCHAR(100) UNIQUE NOT NULL, -- ID único da base de dados
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_database_id ON organizations(database_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);

-- ============================================================================
-- 2. TABELA: organization_members (Membros das organizações)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Garantir que um usuário só pode ter um papel por organização
    UNIQUE(organization_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- ============================================================================
-- 3. ADICIONAR organization_id às tabelas existentes
-- ============================================================================

-- Adicionar organization_id à tabela profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela profiles';
    ELSE
        RAISE NOTICE 'Coluna organization_id já existe na tabela profiles';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em profiles: %', SQLERRM;
END $$;

-- Adicionar organization_id à tabela user_permissions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE user_permissions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_user_permissions_organization_id ON user_permissions(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela user_permissions';
    ELSE
        RAISE NOTICE 'Coluna organization_id já existe na tabela user_permissions';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em user_permissions: %', SQLERRM;
END $$;

-- Adicionar organization_id às tabelas de teste
DO $$ 
BEGIN
    -- test_plans
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_plans' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_plans 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_plans_organization_id ON test_plans(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_plans';
    END IF;

    -- test_cases
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_cases' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_cases 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_cases_organization_id ON test_cases(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_cases';
    END IF;

    -- test_executions
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_executions' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_executions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_executions_organization_id ON test_executions(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_executions';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id nas tabelas de teste: %', SQLERRM;
END $$;

-- Adicionar organization_id às tabelas do To-Do
DO $$ 
BEGIN
    -- todo_folders
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_folders' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_folders 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_folders_organization_id ON todo_folders(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_folders';
    END IF;

    -- todo_tasks
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_tasks' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_tasks 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_tasks_organization_id ON todo_tasks(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_tasks';
    END IF;

    -- todo_subtasks
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_subtasks' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_subtasks 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_subtasks_organization_id ON todo_subtasks(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_subtasks';
    END IF;

    -- todo_attachments
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_attachments' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_attachments 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_attachments_organization_id ON todo_attachments(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_attachments';
    END IF;

    -- todo_comments
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_comments' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_comments 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_comments_organization_id ON todo_comments(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_comments';
    END IF;

    -- todo_activity_log
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_activity_log' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_activity_log 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_activity_log_organization_id ON todo_activity_log(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_activity_log';
    END IF;

    -- todo_templates
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_templates' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_templates 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_templates_organization_id ON todo_templates(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_templates';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id nas tabelas do To-Do: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para gerar ID único de base de dados
CREATE OR REPLACE FUNCTION generate_database_id()
RETURNS VARCHAR AS $$
DECLARE
    db_id VARCHAR;
BEGIN
    -- Gerar ID único baseado em timestamp + random
    db_id := 'db_' || to_char(now(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    RETURN db_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar organização padrão
CREATE OR REPLACE FUNCTION create_default_organization(org_name VARCHAR, org_slug VARCHAR)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
    db_id VARCHAR;
BEGIN
    -- Gerar ID único da base de dados
    db_id := generate_database_id();
    
    -- Criar organização
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES (org_name, org_slug, 'Organização criada automaticamente', db_id)
    RETURNING id INTO org_id;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- Função para associar usuário a uma organização
CREATE OR REPLACE FUNCTION associate_user_to_organization(
    user_uuid UUID, 
    org_uuid UUID, 
    user_role user_role DEFAULT 'viewer',
    member_status VARCHAR DEFAULT 'active'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Inserir membro da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (org_uuid, user_uuid, user_role, member_status, 
            CASE WHEN member_status = 'active' THEN NOW() ELSE NULL END)
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at;
    
    -- Atualizar perfil do usuário
    UPDATE profiles 
    SET organization_id = org_uuid
    WHERE id = user_uuid;
    
    -- Atualizar permissões do usuário
    UPDATE user_permissions 
    SET organization_id = org_uuid
    WHERE user_id = user_uuid;
    
    RETURN TRUE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao associar usuário à organização: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Políticas para organizations
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Organization masters can manage their organization" ON organizations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
            AND role = 'master'
        )
    );

-- Políticas para organization_members
CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid()
        )
    );

CREATE POLICY "Organization masters can manage members" ON organization_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid()
            AND om2.role = 'master'
        )
    );

-- ============================================================================
-- 6. CRIAR ORGANIZAÇÃO PADRÃO PARA DADOS EXISTENTES
-- ============================================================================

DO $$
DECLARE
    default_org_id UUID;
    default_db_id VARCHAR;
BEGIN
    -- Criar organização padrão para dados existentes
    default_db_id := generate_database_id();
    
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES ('Organização Padrão', 'default', 'Organização padrão para dados existentes', default_db_id)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO default_org_id;
    
    -- Se não conseguiu inserir (já existe), buscar o ID
    IF default_org_id IS NULL THEN
        SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
    END IF;
    
    -- Associar todos os usuários existentes à organização padrão
    UPDATE profiles 
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    UPDATE user_permissions 
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    -- Associar usuários como membros da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    SELECT default_org_id, id, role, 'active', NOW()
    FROM profiles
    WHERE organization_id = default_org_id
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Organização padrão criada e usuários associados';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao criar organização padrão: %', SQLERRM;
END $$;

-- ============================================================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE organizations IS 'Organizações/Tenants do sistema multi-tenant';
COMMENT ON TABLE organization_members IS 'Membros das organizações com seus papéis';
COMMENT ON COLUMN organizations.database_id IS 'ID único da base de dados para identificação';
COMMENT ON COLUMN organization_members.status IS 'Status do membro: pending, active, suspended';
COMMENT ON COLUMN organization_members.role IS 'Papel do usuário na organização';

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Sistema de organizações criado com sucesso - multi-tenant implementado';
END $$;

-- Data: 2025-01-15
-- Descrição: Implementa sistema multi-tenant com organizações isoladas

-- ============================================================================
-- 1. TABELA: organizations (Organizações/Tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    database_id VARCHAR(100) UNIQUE NOT NULL, -- ID único da base de dados
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_database_id ON organizations(database_id);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);

-- ============================================================================
-- 2. TABELA: organization_members (Membros das organizações)
-- ============================================================================
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    
    -- Garantir que um usuário só pode ter um papel por organização
    UNIQUE(organization_id, user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_status ON organization_members(status);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(role);

-- ============================================================================
-- 3. ADICIONAR organization_id às tabelas existentes
-- ============================================================================

-- Adicionar organization_id à tabela profiles
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE profiles 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela profiles';
    ELSE
        RAISE NOTICE 'Coluna organization_id já existe na tabela profiles';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em profiles: %', SQLERRM;
END $$;

-- Adicionar organization_id à tabela user_permissions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user_permissions' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE user_permissions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_user_permissions_organization_id ON user_permissions(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela user_permissions';
    ELSE
        RAISE NOTICE 'Coluna organization_id já existe na tabela user_permissions';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id em user_permissions: %', SQLERRM;
END $$;

-- Adicionar organization_id às tabelas de teste
DO $$ 
BEGIN
    -- test_plans
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_plans' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_plans 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_plans_organization_id ON test_plans(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_plans';
    END IF;

    -- test_cases
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_cases' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_cases 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_cases_organization_id ON test_cases(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_cases';
    END IF;

    -- test_executions
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'test_executions' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE test_executions 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_test_executions_organization_id ON test_executions(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela test_executions';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id nas tabelas de teste: %', SQLERRM;
END $$;

-- Adicionar organization_id às tabelas do To-Do
DO $$ 
BEGIN
    -- todo_folders
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_folders' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_folders 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_folders_organization_id ON todo_folders(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_folders';
    END IF;

    -- todo_tasks
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_tasks' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_tasks 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_tasks_organization_id ON todo_tasks(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_tasks';
    END IF;

    -- todo_subtasks
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_subtasks' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_subtasks 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_subtasks_organization_id ON todo_subtasks(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_subtasks';
    END IF;

    -- todo_attachments
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_attachments' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_attachments 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_attachments_organization_id ON todo_attachments(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_attachments';
    END IF;

    -- todo_comments
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_comments' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_comments 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_comments_organization_id ON todo_comments(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_comments';
    END IF;

    -- todo_activity_log
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_activity_log' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_activity_log 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_activity_log_organization_id ON todo_activity_log(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_activity_log';
    END IF;

    -- todo_templates
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'todo_templates' 
        AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE todo_templates 
        ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_todo_templates_organization_id ON todo_templates(organization_id);
        RAISE NOTICE 'Coluna organization_id adicionada à tabela todo_templates';
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao adicionar organization_id nas tabelas do To-Do: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para gerar ID único de base de dados
CREATE OR REPLACE FUNCTION generate_database_id()
RETURNS VARCHAR AS $$
DECLARE
    db_id VARCHAR;
BEGIN
    -- Gerar ID único baseado em timestamp + random
    db_id := 'db_' || to_char(now(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    RETURN db_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar organização padrão
CREATE OR REPLACE FUNCTION create_default_organization(org_name VARCHAR, org_slug VARCHAR)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
    db_id VARCHAR;
BEGIN
    -- Gerar ID único da base de dados
    db_id := generate_database_id();
    
    -- Criar organização
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES (org_name, org_slug, 'Organização criada automaticamente', db_id)
    RETURNING id INTO org_id;
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- Função para associar usuário a uma organização
CREATE OR REPLACE FUNCTION associate_user_to_organization(
    user_uuid UUID, 
    org_uuid UUID, 
    user_role user_role DEFAULT 'viewer',
    member_status VARCHAR DEFAULT 'active'
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Inserir membro da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (org_uuid, user_uuid, user_role, member_status, 
            CASE WHEN member_status = 'active' THEN NOW() ELSE NULL END)
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET 
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at;
    
    -- Atualizar perfil do usuário
    UPDATE profiles 
    SET organization_id = org_uuid
    WHERE id = user_uuid;
    
    -- Atualizar permissões do usuário
    UPDATE user_permissions 
    SET organization_id = org_uuid
    WHERE user_id = user_uuid;
    
    RETURN TRUE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao associar usuário à organização: %', SQLERRM;
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Políticas para organizations
CREATE POLICY "Users can view organizations they belong to" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Organization masters can manage their organization" ON organizations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid()
            AND role = 'master'
        )
    );

-- Políticas para organization_members
CREATE POLICY "Users can view members of their organizations" ON organization_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid()
        )
    );

CREATE POLICY "Organization masters can manage members" ON organization_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members om2
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid()
            AND om2.role = 'master'
        )
    );

-- ============================================================================
-- 6. CRIAR ORGANIZAÇÃO PADRÃO PARA DADOS EXISTENTES
-- ============================================================================

DO $$
DECLARE
    default_org_id UUID;
    default_db_id VARCHAR;
BEGIN
    -- Criar organização padrão para dados existentes
    default_db_id := generate_database_id();
    
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES ('Organização Padrão', 'default', 'Organização padrão para dados existentes', default_db_id)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO default_org_id;
    
    -- Se não conseguiu inserir (já existe), buscar o ID
    IF default_org_id IS NULL THEN
        SELECT id INTO default_org_id FROM organizations WHERE slug = 'default';
    END IF;
    
    -- Associar todos os usuários existentes à organização padrão
    UPDATE profiles 
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    UPDATE user_permissions 
    SET organization_id = default_org_id
    WHERE organization_id IS NULL;
    
    -- Associar usuários como membros da organização
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    SELECT default_org_id, id, role, 'active', NOW()
    FROM profiles
    WHERE organization_id = default_org_id
    ON CONFLICT (organization_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Organização padrão criada e usuários associados';
    
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao criar organização padrão: %', SQLERRM;
END $$;

-- ============================================================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE organizations IS 'Organizações/Tenants do sistema multi-tenant';
COMMENT ON TABLE organization_members IS 'Membros das organizações com seus papéis';
COMMENT ON COLUMN organizations.database_id IS 'ID único da base de dados para identificação';
COMMENT ON COLUMN organization_members.status IS 'Status do membro: pending, active, suspended';
COMMENT ON COLUMN organization_members.role IS 'Papel do usuário na organização';

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Sistema de organizações criado com sucesso - multi-tenant implementado';
END $$;

 
 