-- ===============================================
-- CORREÇÃO FINAL - ORGANIZAÇÕES E FLUXO DE USUÁRIO
-- ===============================================

-- 1. REMOVER POLÍTICAS PROBLEMÁTICAS
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "Organization masters can manage their organization" ON organizations;
DROP POLICY IF EXISTS "Masters can manage organization" ON organizations;
DROP POLICY IF EXISTS "Members can view organization" ON organizations;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization masters can manage members" ON organization_members;
DROP POLICY IF EXISTS "Masters and admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;

-- 2. POLÍTICAS CORRIGIDAS PARA ORGANIZATIONS
CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their organizations" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid() 
            AND status = 'active'
        )
    );

CREATE POLICY "Masters can update their organizations" ON organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = organizations.id 
            AND user_id = auth.uid() 
            AND role = 'master' 
            AND status = 'active'
        )
    );

-- 3. POLÍTICAS CORRIGIDAS PARA ORGANIZATION_MEMBERS
CREATE POLICY "Users can add themselves to organizations" ON organization_members
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view organization members" ON organization_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om2 
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid() 
            AND om2.status = 'active'
        )
    );

CREATE POLICY "Masters can manage organization members" ON organization_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members om2 
            WHERE om2.organization_id = organization_members.organization_id 
            AND om2.user_id = auth.uid() 
            AND om2.role = 'master' 
            AND om2.status = 'active'
        )
    );

-- 4. FUNÇÃO PARA CRIAR ORGANIZAÇÃO COM USUÁRIO MASTER
CREATE OR REPLACE FUNCTION create_organization_with_master(
    org_name TEXT,
    org_slug TEXT,
    org_description TEXT DEFAULT '',
    user_id UUID DEFAULT auth.uid()
)
RETURNS UUID AS $$
DECLARE
    org_id UUID;
    db_id TEXT;
BEGIN
    -- Verificar se usuário está autenticado
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    -- Gerar ID único da base de dados
    db_id := 'db_' || to_char(now(), 'YYYYMMDD_HH24MISS') || '_' || substr(md5(random()::text), 1, 8);
    
    -- Criar organização
    INSERT INTO organizations (name, slug, description, database_id)
    VALUES (org_name, org_slug, org_description, db_id)
    RETURNING id INTO org_id;
    
    -- Adicionar usuário como master
    INSERT INTO organization_members (organization_id, user_id, role, status, accepted_at)
    VALUES (org_id, user_id, 'master', 'active', NOW());
    
    RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VERIFICAÇÃO E LIMPEZA
DO $$ 
DECLARE
    org_count INTEGER;
    member_count INTEGER;
BEGIN
    -- Contar organizações
    SELECT COUNT(*) INTO org_count FROM organizations;
    
    -- Contar membros
    SELECT COUNT(*) INTO member_count FROM organization_members;
    
    RAISE NOTICE '✅ Políticas RLS corrigidas para organizações';
    RAISE NOTICE '✅ Função create_organization_with_master criada';
    RAISE NOTICE '📊 Organizações existentes: %', org_count;
    RAISE NOTICE '👥 Membros existentes: %', member_count;
    RAISE NOTICE '🚀 Sistema pronto para criação de organizações!';
END $$; 