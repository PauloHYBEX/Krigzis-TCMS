-- Migration: Sistema de Tokens de Acesso e Logs
-- Data: 2025-01-16
-- Descrição: Implementa tokens expiráveis e logs de acesso para organizações

-- ============================================================================
-- 1. TABELA: access_tokens (Tokens de acesso para organizações)
-- ============================================================================
CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_access_tokens_token ON access_tokens(token);
CREATE INDEX IF NOT EXISTS idx_access_tokens_organization_id ON access_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_tokens_expires_at ON access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_access_tokens_active ON access_tokens(is_active);

-- ============================================================================
-- 2. TABELA: access_logs (Logs de tentativas de acesso)
-- ============================================================================
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_access_logs_organization_id ON access_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_token_id ON access_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);
CREATE INDEX IF NOT EXISTS idx_access_logs_status ON access_logs(status);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_email ON access_logs(user_email);

-- ============================================================================
-- 3. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para gerar token único
CREATE OR REPLACE FUNCTION generate_access_token()
RETURNS VARCHAR AS $$
DECLARE
    token VARCHAR;
    attempts INTEGER := 0;
    max_attempts INTEGER := 10;
BEGIN
    LOOP
        -- Gerar token baseado em timestamp + random + caracteres especiais
        token := 'QC_' || 
                 to_char(now(), 'YYYYMMDD_HH24MISS') || '_' || 
                 substr(md5(random()::text), 1, 8) || '_' ||
                 substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36 + 1)::integer, 1) ||
                 substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', floor(random() * 36 + 1)::integer, 1);
        
        -- Verificar se token já existe
        IF NOT EXISTS (SELECT 1 FROM access_tokens WHERE token = token) THEN
            RETURN token;
        END IF;
        
        attempts := attempts + 1;
        IF attempts >= max_attempts THEN
            RAISE EXCEPTION 'Não foi possível gerar token único após % tentativas', max_attempts;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para criar token de acesso
CREATE OR REPLACE FUNCTION create_access_token(
    org_uuid UUID,
    token_description TEXT DEFAULT NULL,
    token_duration_seconds INTEGER DEFAULT 40,
    max_uses_count INTEGER DEFAULT 1
)
RETURNS VARCHAR AS $$
DECLARE
    generated_token VARCHAR;
    token_id UUID;
BEGIN
    -- Gerar token único
    generated_token := generate_access_token();
    
    -- Inserir token no banco
    INSERT INTO access_tokens (
        organization_id,
        token,
        description,
        created_by,
        expires_at,
        max_uses
    ) VALUES (
        org_uuid,
        generated_token,
        token_description,
        auth.uid(),
        NOW() + (token_duration_seconds || ' seconds')::INTERVAL,
        max_uses_count
    ) RETURNING id INTO token_id;
    
    -- Registrar log de criação
    INSERT INTO access_logs (
        organization_id,
        token_id,
        user_email,
        action,
        status,
        details
    ) VALUES (
        org_uuid,
        token_id,
        (SELECT email FROM auth.users WHERE id = auth.uid()),
        'token_created',
        'success',
        jsonb_build_object(
            'token', generated_token,
            'expires_at', NOW() + (token_duration_seconds || ' seconds')::INTERVAL,
            'max_uses', max_uses_count
        )
    );
    
    RETURN generated_token;
END;
$$ LANGUAGE plpgsql;

-- Função para validar e usar token
CREATE OR REPLACE FUNCTION validate_and_use_token(
    token_string VARCHAR,
    user_email VARCHAR DEFAULT NULL,
    user_ip INET DEFAULT NULL,
    user_agent TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    token_record RECORD;
    result JSONB;
BEGIN
    -- Buscar token
    SELECT * INTO token_record 
    FROM access_tokens 
    WHERE token = token_string 
    AND is_active = TRUE;
    
    -- Se token não existe
    IF token_record IS NULL THEN
        INSERT INTO access_logs (
            user_email,
            action,
            status,
            details,
            user_ip,
            user_agent
        ) VALUES (
            user_email,
            'token_invalid',
            'failed',
            jsonb_build_object('token', token_string, 'reason', 'token_not_found'),
            user_ip,
            user_agent
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Token inválido',
            'code', 'INVALID_TOKEN'
        );
    END IF;
    
    -- Verificar se token expirou
    IF token_record.expires_at < NOW() THEN
        INSERT INTO access_logs (
            organization_id,
            token_id,
            user_email,
            action,
            status,
            details,
            user_ip,
            user_agent
        ) VALUES (
            token_record.organization_id,
            token_record.id,
            user_email,
            'token_expired',
            'expired',
            jsonb_build_object(
                'token', token_string,
                'expired_at', token_record.expires_at,
                'current_time', NOW()
            ),
            user_ip,
            user_agent
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Token expirado',
            'code', 'TOKEN_EXPIRED',
            'expired_at', token_record.expires_at
        );
    END IF;
    
    -- Verificar se atingiu limite de usos
    IF token_record.current_uses >= token_record.max_uses THEN
        INSERT INTO access_logs (
            organization_id,
            token_id,
            user_email,
            action,
            status,
            details,
            user_ip,
            user_agent
        ) VALUES (
            token_record.organization_id,
            token_record.id,
            user_email,
            'token_max_uses_reached',
            'failed',
            jsonb_build_object(
                'token', token_string,
                'current_uses', token_record.current_uses,
                'max_uses', token_record.max_uses
            ),
            user_ip,
            user_agent
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Token atingiu limite de usos',
            'code', 'MAX_USES_REACHED'
        );
    END IF;
    
    -- Token válido - incrementar uso
    UPDATE access_tokens 
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE id = token_record.id;
    
    -- Registrar uso bem-sucedido
    INSERT INTO access_logs (
        organization_id,
        token_id,
        user_email,
        action,
        status,
        details,
        user_ip,
        user_agent
    ) VALUES (
        token_record.organization_id,
        token_record.id,
        user_email,
        'token_used',
        'success',
        jsonb_build_object(
            'token', token_string,
            'organization_id', token_record.organization_id,
            'uses_remaining', token_record.max_uses - (token_record.current_uses + 1)
        ),
        user_ip,
        user_agent
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'organization_id', token_record.organization_id,
        'uses_remaining', token_record.max_uses - (token_record.current_uses + 1),
        'expires_at', token_record.expires_at
    );
END;
$$ LANGUAGE plpgsql;

-- Função para limpar tokens expirados
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE access_tokens 
    SET is_active = FALSE 
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_access_tokens_updated_at
    BEFORE UPDATE ON access_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para access_tokens
CREATE POLICY "Users can view tokens of their organizations" ON access_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = access_tokens.organization_id 
            AND user_id = auth.uid()
            AND role IN ('master', 'admin')
        )
    );

CREATE POLICY "Organization masters can manage tokens" ON access_tokens
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = access_tokens.organization_id 
            AND user_id = auth.uid()
            AND role = 'master'
        )
    );

-- Políticas para access_logs
CREATE POLICY "Users can view logs of their organizations" ON access_logs
    FOR SELECT USING (
        organization_id IS NULL OR
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE organization_id = access_logs.organization_id 
            AND user_id = auth.uid()
            AND role IN ('master', 'admin')
        )
    );

CREATE POLICY "System can insert logs" ON access_logs
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 6. JOB PARA LIMPEZA AUTOMÁTICA (se disponível)
-- ============================================================================

-- Comentário sobre limpeza automática
COMMENT ON FUNCTION cleanup_expired_tokens IS 'Função para limpar tokens expirados. Pode ser executada via cron job ou agendador.';

-- ============================================================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE access_tokens IS 'Tokens de acesso temporários para organizações';
COMMENT ON TABLE access_logs IS 'Logs de tentativas de acesso e uso de tokens';
COMMENT ON COLUMN access_tokens.token IS 'Token único para acesso à organização';
COMMENT ON COLUMN access_tokens.expires_at IS 'Data/hora de expiração do token';
COMMENT ON COLUMN access_tokens.max_uses IS 'Número máximo de usos permitidos';
COMMENT ON COLUMN access_tokens.current_uses IS 'Número atual de usos';
COMMENT ON COLUMN access_logs.action IS 'Ação realizada: token_created, token_used, token_expired, etc.';
COMMENT ON COLUMN access_logs.status IS 'Status da ação: success, failed, expired, invalid';

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'Sistema de tokens de acesso e logs criado com sucesso';
    RAISE NOTICE 'Tokens expiram automaticamente em 40 segundos por padrão';
    RAISE NOTICE 'Use create_access_token() para gerar novos tokens';
    RAISE NOTICE 'Use validate_and_use_token() para validar tokens';
END $$;

 
 