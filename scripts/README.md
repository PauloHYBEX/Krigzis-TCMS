# Scripts Utilitários GoTesting

## Script para Atualizar Role de Usuário

Este script permite atualizar a role de um usuário específico no sistema.

### Pré-requisitos

1. Node.js instalado
2. Acesso às credenciais do Supabase (Service Role Key)

### Configuração

1. **Instalar dependências:**
   ```bash
   cd scripts
   npm install
   ```

2. **Configurar variáveis de ambiente:**
   ```bash
   # Copie o arquivo de exemplo
   cp env.example .env
   
   # Edite o arquivo .env com suas credenciais reais
   notepad .env
   ```

3. **Preencher o arquivo .env:**
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_do_supabase
   ```

### Como usar

#### Método 1: Executar diretamente
```bash
cd scripts
node update-user-role.js
```

#### Método 2: Usar npm script
```bash
cd scripts
npm run update-user
```

### O que o script faz

1. **Busca o usuário** pelo email `paulo.santos@hybex.com.br`
2. **Verifica a role atual** e mostra as informações do usuário
3. **Atualiza a role** para `master` na tabela `profiles`
4. **Atualiza as permissões** na tabela `user_permissions` com todas as permissões de master
5. **Mostra um resumo** das alterações realizadas

### Permissões do Master

O usuário receberá todas estas permissões:
- ✅ can_manage_users
- ✅ can_manage_plans
- ✅ can_manage_cases
- ✅ can_manage_executions
- ✅ can_view_reports
- ✅ can_use_ai
- ✅ can_access_model_control
- ✅ can_configure_ai_models
- ✅ can_test_ai_connections
- ✅ can_manage_ai_templates
- ✅ can_select_ai_models
- ✅ can_access_todo
- ✅ can_manage_todo_folders
- ✅ can_manage_todo_tasks
- ✅ can_manage_all_todos
- ✅ can_upload_attachments
- ✅ can_comment_tasks
- ✅ can_assign_tasks

### Resolução de Problemas

- **Usuário não encontrado**: O script listará todos os usuários disponíveis
- **Erro de conexão**: Verifique as credenciais no arquivo `.env`
- **Erro de permissões**: Certifique-se de estar usando a Service Role Key correta

### Segurança

⚠️ **IMPORTANTE**: A Service Role Key tem privilégios administrativos completos. Mantenha-a segura e nunca compartilhe! 