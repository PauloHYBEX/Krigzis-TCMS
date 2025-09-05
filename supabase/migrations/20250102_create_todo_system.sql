-- Migration: Sistema To-Do List Integrado
-- Data: 2025-01-02
-- Descrição: Criação completa do sistema de To-Do List com integração ao sistema de testes

-- ============================================================================
-- 1. TABELA: todo_folders (Pastas organizacionais)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50) DEFAULT 'folder',
    parent_folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    is_archived BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_todo_folders_user_id ON todo_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_folders_parent_id ON todo_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_todo_folders_position ON todo_folders(position);

-- ============================================================================
-- 2. TABELA: todo_tasks (Tarefas principais)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID NOT NULL REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    content JSONB,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'archived', 'cancelled')),
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    position INTEGER NOT NULL DEFAULT 0,
    tags TEXT[],
    
    -- Vinculações com sistema de testes
    linked_plan_id UUID REFERENCES test_plans(id) ON DELETE SET NULL,
    linked_case_id UUID REFERENCES test_cases(id) ON DELETE SET NULL,
    linked_execution_id UUID REFERENCES test_executions(id) ON DELETE SET NULL,
    
    -- Gestão de tempo e progresso
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Funcionalidades avançadas
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern JSONB,
    reminder_date TIMESTAMPTZ,
    is_template BOOLEAN DEFAULT FALSE,
    template_name VARCHAR(255),
    
    -- Metadados
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_todo_tasks_folder_id ON todo_tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_user_id ON todo_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_assigned_to ON todo_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_priority ON todo_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_linked_plan ON todo_tasks(linked_plan_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_linked_case ON todo_tasks(linked_case_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_linked_execution ON todo_tasks(linked_execution_id);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_tags ON todo_tasks USING GIN(tags);

-- ============================================================================
-- 3. TABELA: todo_subtasks (Sub-tarefas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMPTZ,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_todo_subtasks_task_id ON todo_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_subtasks_position ON todo_subtasks(position);
CREATE INDEX IF NOT EXISTS idx_todo_subtasks_assigned_to ON todo_subtasks(assigned_to);

-- ============================================================================
-- 4. TABELA: todo_attachments (Anexos de arquivos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    storage_bucket VARCHAR(100) DEFAULT 'todo-attachments',
    description TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_todo_attachments_task_id ON todo_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_attachments_user_id ON todo_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_attachments_active ON todo_attachments(is_active);

-- ============================================================================
-- 5. TABELA: todo_comments (Sistema de comentários)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES todo_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'html')),
    is_edited BOOLEAN DEFAULT FALSE,
    parent_comment_id UUID REFERENCES todo_comments(id) ON DELETE CASCADE,
    mentions UUID[],
    reactions JSONB DEFAULT '{}',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_todo_comments_task_id ON todo_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_comments_user_id ON todo_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_comments_parent_id ON todo_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_todo_comments_mentions ON todo_comments USING GIN(mentions);

-- ============================================================================
-- 6. TABELA: todo_activity_log (Log de atividades)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES todo_tasks(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES todo_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'folder', 'subtask', 'comment', 'attachment')),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_todo_activity_task_id ON todo_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_todo_activity_user_id ON todo_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_activity_created_at ON todo_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_todo_activity_action ON todo_activity_log(action);

-- ============================================================================
-- 7. TABELA: todo_templates (Templates de tarefas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS todo_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_todo_templates_user_id ON todo_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_todo_templates_category ON todo_templates(category);
CREATE INDEX IF NOT EXISTS idx_todo_templates_public ON todo_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_todo_templates_tags ON todo_templates USING GIN(tags);

-- ============================================================================
-- 8. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_todo_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular progresso da tarefa baseado nas sub-tarefas
CREATE OR REPLACE FUNCTION calculate_task_progress(task_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_subtasks INTEGER;
    completed_subtasks INTEGER;
    progress INTEGER;
BEGIN
    -- Conta total de sub-tarefas
    SELECT COUNT(*) INTO total_subtasks
    FROM todo_subtasks
    WHERE task_id = task_uuid;
    
    -- Se não há sub-tarefas, retorna o progresso manual
    IF total_subtasks = 0 THEN
        SELECT progress_percentage INTO progress
        FROM todo_tasks
        WHERE id = task_uuid;
        RETURN COALESCE(progress, 0);
    END IF;
    
    -- Conta sub-tarefas completas
    SELECT COUNT(*) INTO completed_subtasks
    FROM todo_subtasks
    WHERE task_id = task_uuid AND is_completed = TRUE;
    
    -- Calcula porcentagem
    progress := ROUND((completed_subtasks::DECIMAL / total_subtasks::DECIMAL) * 100);
    
    -- Atualiza a tarefa
    UPDATE todo_tasks
    SET progress_percentage = progress,
        updated_at = NOW()
    WHERE id = task_uuid;
    
    RETURN progress;
END;
$$ LANGUAGE plpgsql;

-- Função para log de atividades
CREATE OR REPLACE FUNCTION log_todo_activity()
RETURNS TRIGGER AS $$
DECLARE
    action_type VARCHAR(50);
    entity_type VARCHAR(20);
BEGIN
    -- Determina o tipo de ação
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
    END IF;
    
    -- Determina o tipo de entidade baseado na tabela
    entity_type := CASE TG_TABLE_NAME
        WHEN 'todo_tasks' THEN 'task'
        WHEN 'todo_folders' THEN 'folder'
        WHEN 'todo_subtasks' THEN 'subtask'
        WHEN 'todo_comments' THEN 'comment'
        WHEN 'todo_attachments' THEN 'attachment'
        ELSE 'unknown'
    END;
    
    -- Insere log de atividade
    IF TG_OP = 'DELETE' THEN
        INSERT INTO todo_activity_log (
            task_id, folder_id, user_id, action, entity_type, entity_id, old_values
        ) VALUES (
            CASE WHEN entity_type = 'task' THEN OLD.id ELSE OLD.task_id END,
            CASE WHEN entity_type = 'folder' THEN OLD.id ELSE NULL END,
            OLD.user_id,
            action_type,
            entity_type,
            OLD.id,
            row_to_json(OLD)
        );
        RETURN OLD;
    ELSE
        INSERT INTO todo_activity_log (
            task_id, folder_id, user_id, action, entity_type, entity_id, old_values, new_values
        ) VALUES (
            CASE WHEN entity_type = 'task' THEN NEW.id ELSE NEW.task_id END,
            CASE WHEN entity_type = 'folder' THEN NEW.id ELSE NULL END,
            NEW.user_id,
            action_type,
            entity_type,
            NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
            row_to_json(NEW)
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Triggers para updated_at
CREATE TRIGGER update_todo_folders_updated_at
    BEFORE UPDATE ON todo_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at_column();

CREATE TRIGGER update_todo_tasks_updated_at
    BEFORE UPDATE ON todo_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at_column();

CREATE TRIGGER update_todo_subtasks_updated_at
    BEFORE UPDATE ON todo_subtasks
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at_column();

CREATE TRIGGER update_todo_comments_updated_at
    BEFORE UPDATE ON todo_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at_column();

CREATE TRIGGER update_todo_templates_updated_at
    BEFORE UPDATE ON todo_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_todo_updated_at_column();

-- Trigger para calcular progresso quando sub-tarefa é alterada
CREATE TRIGGER recalculate_task_progress
    AFTER INSERT OR UPDATE OR DELETE ON todo_subtasks
    FOR EACH ROW
    EXECUTE FUNCTION calculate_task_progress(COALESCE(NEW.task_id, OLD.task_id));

-- Triggers para log de atividades
CREATE TRIGGER log_todo_folders_activity
    AFTER INSERT OR UPDATE OR DELETE ON todo_folders
    FOR EACH ROW
    EXECUTE FUNCTION log_todo_activity();

CREATE TRIGGER log_todo_tasks_activity
    AFTER INSERT OR UPDATE OR DELETE ON todo_tasks
    FOR EACH ROW
    EXECUTE FUNCTION log_todo_activity();

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE todo_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. POLÍTICAS RLS - todo_folders
-- ============================================================================
CREATE POLICY "Users can view their own folders or shared folders" ON todo_folders
    FOR SELECT USING (
        user_id = auth.uid() OR 
        auth.uid() = ANY(shared_with) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        )
    );

CREATE POLICY "Users can create their own folders" ON todo_folders
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own folders" ON todo_folders
    FOR UPDATE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        )
    );

CREATE POLICY "Users can delete their own folders" ON todo_folders
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        )
    );

-- ============================================================================
-- 12. POLÍTICAS RLS - todo_tasks
-- ============================================================================
CREATE POLICY "Users can view tasks they own, are assigned to, or can manage all" ON todo_tasks
    FOR SELECT USING (
        user_id = auth.uid() OR 
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        ) OR
        EXISTS (
            SELECT 1 FROM user_permissions 
            WHERE user_id = auth.uid() 
            AND can_manage_all_todos = TRUE
        )
    );

CREATE POLICY "Users can create tasks in their folders" ON todo_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM todo_folders 
            WHERE id = folder_id 
            AND (user_id = auth.uid() OR auth.uid() = ANY(shared_with))
        )
    );

CREATE POLICY "Users can update tasks they own or are assigned to" ON todo_tasks
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        assigned_to = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        )
    );

CREATE POLICY "Users can delete tasks they own" ON todo_tasks
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        )
    );

-- ============================================================================
-- 13. POLÍTICAS RLS - Outras tabelas
-- ============================================================================

-- todo_subtasks
CREATE POLICY "Users can manage subtasks of tasks they can access" ON todo_subtasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM todo_tasks 
            WHERE id = task_id 
            AND (user_id = auth.uid() OR assigned_to = auth.uid())
        )
    );

-- todo_attachments
CREATE POLICY "Users can manage attachments of tasks they can access" ON todo_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM todo_tasks 
            WHERE id = task_id 
            AND (user_id = auth.uid() OR assigned_to = auth.uid())
        )
    );

-- todo_comments
CREATE POLICY "Users can view and create comments on accessible tasks" ON todo_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM todo_tasks 
            WHERE id = task_id 
            AND (user_id = auth.uid() OR assigned_to = auth.uid())
        )
    );

-- todo_activity_log
CREATE POLICY "Users can view activity log of their tasks" ON todo_activity_log
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM todo_tasks 
            WHERE id = task_id 
            AND (user_id = auth.uid() OR assigned_to = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('master', 'admin')
        )
    );

-- todo_templates
CREATE POLICY "Users can view public templates or their own" ON todo_templates
    FOR SELECT USING (user_id = auth.uid() OR is_public = TRUE);

CREATE POLICY "Users can manage their own templates" ON todo_templates
    FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- 14. COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE todo_folders IS 'Pastas organizacionais para categorização de tarefas';
COMMENT ON TABLE todo_tasks IS 'Tarefas principais do sistema To-Do com integração aos testes';
COMMENT ON TABLE todo_subtasks IS 'Sub-tarefas para decomposição de tarefas complexas';
COMMENT ON TABLE todo_attachments IS 'Anexos de arquivos vinculados às tarefas';
COMMENT ON TABLE todo_comments IS 'Sistema de comentários para colaboração em tarefas';
COMMENT ON TABLE todo_activity_log IS 'Log de atividades para auditoria e histórico';
COMMENT ON TABLE todo_templates IS 'Templates reutilizáveis para criação rápida de tarefas';

-- Comentários em colunas importantes
COMMENT ON COLUMN todo_tasks.linked_plan_id IS 'Vinculação com plano de teste específico';
COMMENT ON COLUMN todo_tasks.linked_case_id IS 'Vinculação com caso de teste específico';
COMMENT ON COLUMN todo_tasks.linked_execution_id IS 'Vinculação com execução de teste específica';
COMMENT ON COLUMN todo_tasks.content IS 'Conteúdo rico da tarefa em formato JSON (editor)';
COMMENT ON COLUMN todo_tasks.recurrence_pattern IS 'Padrão de recorrência para tarefas repetitivas';

-- ============================================================================
-- 15. DADOS INICIAIS (SEEDS)
-- ============================================================================

-- Função para criar pastas padrão para novos usuários
CREATE OR REPLACE FUNCTION create_default_todo_folders(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    -- Pasta Principal
    INSERT INTO todo_folders (user_id, name, description, color, icon, position)
    VALUES (user_uuid, 'Geral', 'Tarefas gerais e não categorizadas', '#3B82F6', 'folder', 0);
    
    -- Pasta de Projetos
    INSERT INTO todo_folders (user_id, name, description, color, icon, position)
    VALUES (user_uuid, 'Projetos', 'Tarefas relacionadas aos projetos', '#10B981', 'briefcase', 1);
    
    -- Pasta de Testes
    INSERT INTO todo_folders (user_id, name, description, color, icon, position)
    VALUES (user_uuid, 'Testes', 'Tarefas vinculadas ao sistema de testes', '#F59E0B', 'test-tube', 2);
    
    -- Pasta Pessoal
    INSERT INTO todo_folders (user_id, name, description, color, icon, position)
    VALUES (user_uuid, 'Pessoal', 'Tarefas pessoais e desenvolvimento', '#8B5CF6', 'user', 3);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FINALIZAÇÃO
-- ============================================================================
-- Esta migration cria a estrutura completa do sistema To-Do List integrado
-- com funcionalidades avançadas de organização, colaboração e integração
-- com o sistema de testes existente. 