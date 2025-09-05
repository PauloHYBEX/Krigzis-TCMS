# 🎯 **CONFIGURAÇÃO COMPLETA DO SUPABASE**

## 📋 **CHECKLIST - Execute na sua Dashboard do Supabase**

### ✅ **1. CRIAÇÃO DAS TABELAS (OBRIGATÓRIO)**

**📍 Onde:** SQL Editor → Nova Query → Cole o SQL abaixo

```sql
-- ===============================================
-- CONFIGURAÇÃO COMPLETA DO BANCO DE DADOS
-- Execute TUDO de uma vez no SQL Editor
-- ===============================================

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar enum para roles de usuário
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de organizações
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

-- Tabela de membros da organização
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

-- Tabela de permissões de usuário
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Tabela de planos de teste
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

-- Tabela de casos de teste
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

-- Tabela de execuções de teste
CREATE TABLE IF NOT EXISTS test_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    test_case_id UUID REFERENCES test_cases(id) ON DELETE CASCADE,
    executed_by UUID REFERENCES profiles(id),
    result TEXT CHECK (result IN ('passed', 'failed', 'blocked', 'not_tested')),
    notes TEXT,
    execution_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de configurações do usuário
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de pastas de tarefas
CREATE TABLE IF NOT EXISTS todo_folders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de tarefas
CREATE TABLE IF NOT EXISTS todo_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TIMESTAMP WITH TIME ZONE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de tokens de acesso
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

-- Tabela de logs de acesso
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
-- CONFIGURAR RLS (ROW LEVEL SECURITY)
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
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para organizations
DROP POLICY IF EXISTS "Members can view organization" ON organizations;
CREATE POLICY "Members can view organization" ON organizations FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = organizations.id 
    AND user_id = auth.uid() 
    AND status = 'active'
));

DROP POLICY IF EXISTS "Masters can manage organization" ON organizations;
CREATE POLICY "Masters can manage organization" ON organizations FOR ALL 
USING (EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = organizations.id 
    AND user_id = auth.uid() 
    AND role = 'master' 
    AND status = 'active'
));

-- Políticas para organization_members
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
CREATE POLICY "Members can view organization members" ON organization_members FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid() 
    AND om.status = 'active'
));

DROP POLICY IF EXISTS "Masters and admins can manage members" ON organization_members;
CREATE POLICY "Masters and admins can manage members" ON organization_members FOR ALL 
USING (EXISTS (
    SELECT 1 FROM organization_members om 
    WHERE om.organization_id = organization_members.organization_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('master', 'admin') 
    AND om.status = 'active'
));

-- Políticas para user_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
CREATE POLICY "Users can view own permissions" ON user_permissions FOR SELECT 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Masters can manage permissions" ON user_permissions;
CREATE POLICY "Masters can manage permissions" ON user_permissions FOR ALL 
USING (EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = user_permissions.organization_id 
    AND user_id = auth.uid() 
    AND role = 'master' 
    AND status = 'active'
));

-- Políticas para test_plans
DROP POLICY IF EXISTS "Organization members can view test plans" ON test_plans;
CREATE POLICY "Organization members can view test plans" ON test_plans FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = test_plans.organization_id 
    AND user_id = auth.uid() 
    AND status = 'active'
));

DROP POLICY IF EXISTS "Test managers can manage test plans" ON test_plans;
CREATE POLICY "Test managers can manage test plans" ON test_plans FOR ALL 
USING (EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_id = test_plans.organization_id 
    AND user_id = auth.uid() 
    AND role IN ('master', 'admin', 'manager') 
    AND status = 'active'
));

-- Políticas para test_cases
DROP POLICY IF EXISTS "Organization members can view test cases" ON test_cases;
CREATE POLICY "Organization members can view test cases" ON test_cases FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM organization_members om 
    JOIN test_plans tp ON tp.organization_id = om.organization_id 
    WHERE tp.id = test_cases.test_plan_id 
    AND om.user_id = auth.uid() 
    AND om.status = 'active'
));

DROP POLICY IF EXISTS "Test managers can manage test cases" ON test_cases;
CREATE POLICY "Test managers can manage test cases" ON test_cases FOR ALL 
USING (EXISTS (
    SELECT 1 FROM organization_members om 
    JOIN test_plans tp ON tp.organization_id = om.organization_id 
    WHERE tp.id = test_cases.test_plan_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('master', 'admin', 'manager', 'tester') 
    AND om.status = 'active'
));

-- Políticas para test_executions
DROP POLICY IF EXISTS "Organization members can view test executions" ON test_executions;
CREATE POLICY "Organization members can view test executions" ON test_executions FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM organization_members om 
    JOIN test_plans tp ON tp.organization_id = om.organization_id 
    JOIN test_cases tc ON tc.test_plan_id = tp.id 
    WHERE tc.id = test_executions.test_case_id 
    AND om.user_id = auth.uid() 
    AND om.status = 'active'
));

DROP POLICY IF EXISTS "Testers can manage test executions" ON test_executions;
CREATE POLICY "Testers can manage test executions" ON test_executions FOR ALL 
USING (EXISTS (
    SELECT 1 FROM organization_members om 
    JOIN test_plans tp ON tp.organization_id = om.organization_id 
    JOIN test_cases tc ON tc.test_plan_id = tp.id 
    WHERE tc.id = test_executions.test_case_id 
    AND om.user_id = auth.uid() 
    AND om.role IN ('master', 'admin', 'manager', 'tester') 
    AND om.status = 'active'
));

-- Políticas para TODO system
DROP POLICY IF EXISTS "Users can manage own todo folders" ON todo_folders;
CREATE POLICY "Users can manage own todo folders" ON todo_folders FOR ALL 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own todo items" ON todo_items;
CREATE POLICY "Users can manage own todo items" ON todo_items FOR ALL 
USING (user_id = auth.uid());

-- Políticas para user_settings
DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL 
USING (user_id = auth.uid());

-- Políticas para access system
DROP POLICY IF EXISTS "Users can manage own access tokens" ON access_tokens;
CREATE POLICY "Users can manage own access tokens" ON access_tokens FOR ALL 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own access logs" ON access_logs;
CREATE POLICY "Users can view own access logs" ON access_logs FOR SELECT 
USING (user_id = auth.uid());

-- ===============================================
-- FUNÇÕES E TRIGGERS
-- ===============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_plans_updated_at ON test_plans;
CREATE TRIGGER update_test_plans_updated_at BEFORE UPDATE ON test_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_test_cases_updated_at ON test_cases;
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todo_folders_updated_at ON todo_folders;
CREATE TRIGGER update_todo_folders_updated_at BEFORE UPDATE ON todo_folders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_todo_items_updated_at ON todo_items;
CREATE TRIGGER update_todo_items_updated_at BEFORE UPDATE ON todo_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para criar perfil automático quando usuário se registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, email)
    VALUES (new.id, new.raw_user_meta_data->>'display_name', new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automático
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===============================================
-- VERIFICAÇÃO FINAL
-- ===============================================

-- Verificar se todas as tabelas foram criadas
DO $$ 
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'profiles', 'organizations', 'organization_members', 'user_permissions',
        'test_plans', 'test_cases', 'test_executions', 'user_settings',
        'todo_folders', 'todo_items', 'access_tokens', 'access_logs'
    );
    
    RAISE NOTICE 'Tabelas criadas: % de 12 esperadas', table_count;
    
    IF table_count = 12 THEN
        RAISE NOTICE '✅ SUCESSO: Todas as tabelas foram criadas corretamente!';
    ELSE
        RAISE NOTICE '⚠️  AVISO: Algumas tabelas podem não ter sido criadas.';
    END IF;
END $$;
```

---

### ✅ **2. CONFIGURAÇÃO DE AUTENTICAÇÃO (OBRIGATÓRIO)**

**📍 Onde:** Authentication → Settings

1. **Habilitar Providers:**
   - ✅ Email (obrigatório)
   - ✅ Google (opcional)
   - ✅ GitHub (opcional)

2. **Configurar URLs:**
   - **Site URL:** `http://localhost:5173` (desenvolvimento)
   - **Redirect URLs:** `http://localhost:5173/**` (desenvolvimento)

3. **Configurações de Senha:**
   - Minimum password length: `6`
   - ✅ Habilitar "Confirm email"

---

### ✅ **3. VARIÁVEIS DE AMBIENTE (SUA APLICAÇÃO)**

**📍 Onde:** Criar arquivo `.env.local` na raiz do projeto

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

---

### ✅ **4. CONFIGURAÇÕES DE STORAGE (OPCIONAL)**

**📍 Onde:** Storage → Settings

Se usar upload de arquivos:
```sql
-- Criar bucket para uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', true);

-- Política para uploads
CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

---

## 🚀 **ORDEM DE EXECUÇÃO**

1. **PRIMEIRO:** Execute o SQL completo (seção 1)
2. **SEGUNDO:** Configure autenticação (seção 2)  
3. **TERCEIRO:** Configure variáveis de ambiente (seção 3)
4. **QUARTO:** Execute `npm run dev` no seu projeto
5. **QUINTO:** Acesse a aplicação e configure através da interface

---

## ✅ **VERIFICAÇÃO FINAL**

Após executar tudo, você deve ter:

- ✅ 12 tabelas criadas no banco
- ✅ RLS habilitado e políticas configuradas
- ✅ Triggers funcionando
- ✅ Autenticação por email funcionando
- ✅ Sistema funcionando sem erros 406/403

---

## 🆘 **PROBLEMAS COMUNS**

**❌ Erro 406/403:**
- Execute o SQL de configuração primeiro

**❌ "relation does not exist":**
- Verifique se o SQL foi executado completamente

**❌ "RLS policy violation":**
- Verifique se as políticas foram criadas corretamente

**❌ Usuário não consegue fazer login:**
- Verifique configurações de autenticação

---

✨ **Pronto! Seu Supabase está configurado para funcionar perfeitamente com o sistema!** 