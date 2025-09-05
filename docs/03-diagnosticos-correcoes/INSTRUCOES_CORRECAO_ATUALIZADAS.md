# Instruções de Correção Atualizadas - TestMaster AI

## Problema Identificado

O script anterior falhou porque algumas políticas RLS já existem no banco de dados:
```
ERROR: 42710: policy "Users can view tasks they own or are assigned to" for table "todo_tasks" already exists
```

## Solução: Script Essencial

Criei um novo script `fix_essential_only.sql` que **NÃO mexe nas políticas existentes**, apenas corrige os problemas essenciais:

### ✅ **O que o script faz:**
1. **Cria tabela `user_settings`** (se não existir)
2. **Corrige schema das tabelas** `todo_tasks` e `todo_folders`
3. **Adiciona permissões de IA** faltantes
4. **Configura permissões de usuários master**

### ❌ **O que o script NÃO faz:**
- Não remove ou recria políticas RLS existentes
- Não interfere com configurações de segurança atuais

## Como Executar

### Passo 1: Executar Script Essencial
1. Acesse o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o arquivo `fix_essential_only.sql`
4. Verifique se todas as mensagens de sucesso aparecem

### Passo 2: Verificar Correções
Após executar o script, verifique:

```sql
-- Verificar se user_settings foi criada
SELECT * FROM user_settings LIMIT 1;

-- Verificar se user_id existe em todo_tasks
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'todo_tasks' AND column_name = 'user_id';

-- Verificar se permissões de IA foram adicionadas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_permissions' 
AND column_name LIKE '%ai%';
```

## Teste das Funcionalidades

### 1. **MCP (Model Control Panel)**
- Tente salvar configurações
- Verifique se não há mais erros 404

### 2. **Sistema To-Do**
- Tente criar uma nova tarefa
- Verifique se não há mais erros de schema

### 3. **Permissões**
- Desabilite uma permissão para um usuário master
- Verifique se a funcionalidade fica inacessível

## Se Ainda Houver Problemas

### Opção 1: Verificar Políticas Existentes
```sql
-- Ver políticas existentes em todo_tasks
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'todo_tasks';

-- Ver políticas existentes em todo_folders
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'todo_folders';
```

### Opção 2: Script Manual (se necessário)
Se ainda houver problemas, posso criar um script que:
1. Remove políticas específicas
2. Recria apenas as políticas problemáticas
3. Mantém as políticas que estão funcionando

## Status Atual

| Problema | Status | Solução |
|----------|--------|---------|
| Tabela user_settings | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Schema todo_tasks | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Permissões de IA | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Políticas RLS | ✅ Mantidas | Não serão alteradas |

## Próximos Passos

1. **Execute `fix_essential_only.sql`** no Supabase
2. **Teste as funcionalidades** mencionadas
3. **Reporte qualquer problema** que ainda persista

---

**Nota:** Este script é seguro e não interfere com configurações existentes de segurança. 

## Problema Identificado

O script anterior falhou porque algumas políticas RLS já existem no banco de dados:
```
ERROR: 42710: policy "Users can view tasks they own or are assigned to" for table "todo_tasks" already exists
```

## Solução: Script Essencial

Criei um novo script `fix_essential_only.sql` que **NÃO mexe nas políticas existentes**, apenas corrige os problemas essenciais:

### ✅ **O que o script faz:**
1. **Cria tabela `user_settings`** (se não existir)
2. **Corrige schema das tabelas** `todo_tasks` e `todo_folders`
3. **Adiciona permissões de IA** faltantes
4. **Configura permissões de usuários master**

### ❌ **O que o script NÃO faz:**
- Não remove ou recria políticas RLS existentes
- Não interfere com configurações de segurança atuais

## Como Executar

### Passo 1: Executar Script Essencial
1. Acesse o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o arquivo `fix_essential_only.sql`
4. Verifique se todas as mensagens de sucesso aparecem

### Passo 2: Verificar Correções
Após executar o script, verifique:

```sql
-- Verificar se user_settings foi criada
SELECT * FROM user_settings LIMIT 1;

-- Verificar se user_id existe em todo_tasks
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'todo_tasks' AND column_name = 'user_id';

-- Verificar se permissões de IA foram adicionadas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_permissions' 
AND column_name LIKE '%ai%';
```

## Teste das Funcionalidades

### 1. **MCP (Model Control Panel)**
- Tente salvar configurações
- Verifique se não há mais erros 404

### 2. **Sistema To-Do**
- Tente criar uma nova tarefa
- Verifique se não há mais erros de schema

### 3. **Permissões**
- Desabilite uma permissão para um usuário master
- Verifique se a funcionalidade fica inacessível

## Se Ainda Houver Problemas

### Opção 1: Verificar Políticas Existentes
```sql
-- Ver políticas existentes em todo_tasks
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'todo_tasks';

-- Ver políticas existentes em todo_folders
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'todo_folders';
```

### Opção 2: Script Manual (se necessário)
Se ainda houver problemas, posso criar um script que:
1. Remove políticas específicas
2. Recria apenas as políticas problemáticas
3. Mantém as políticas que estão funcionando

## Status Atual

| Problema | Status | Solução |
|----------|--------|---------|
| Tabela user_settings | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Schema todo_tasks | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Permissões de IA | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Políticas RLS | ✅ Mantidas | Não serão alteradas |

## Próximos Passos

1. **Execute `fix_essential_only.sql`** no Supabase
2. **Teste as funcionalidades** mencionadas
3. **Reporte qualquer problema** que ainda persista

---

**Nota:** Este script é seguro e não interfere com configurações existentes de segurança. 

## Problema Identificado

O script anterior falhou porque algumas políticas RLS já existem no banco de dados:
```
ERROR: 42710: policy "Users can view tasks they own or are assigned to" for table "todo_tasks" already exists
```

## Solução: Script Essencial

Criei um novo script `fix_essential_only.sql` que **NÃO mexe nas políticas existentes**, apenas corrige os problemas essenciais:

### ✅ **O que o script faz:**
1. **Cria tabela `user_settings`** (se não existir)
2. **Corrige schema das tabelas** `todo_tasks` e `todo_folders`
3. **Adiciona permissões de IA** faltantes
4. **Configura permissões de usuários master**

### ❌ **O que o script NÃO faz:**
- Não remove ou recria políticas RLS existentes
- Não interfere com configurações de segurança atuais

## Como Executar

### Passo 1: Executar Script Essencial
1. Acesse o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o arquivo `fix_essential_only.sql`
4. Verifique se todas as mensagens de sucesso aparecem

### Passo 2: Verificar Correções
Após executar o script, verifique:

```sql
-- Verificar se user_settings foi criada
SELECT * FROM user_settings LIMIT 1;

-- Verificar se user_id existe em todo_tasks
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'todo_tasks' AND column_name = 'user_id';

-- Verificar se permissões de IA foram adicionadas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_permissions' 
AND column_name LIKE '%ai%';
```

## Teste das Funcionalidades

### 1. **MCP (Model Control Panel)**
- Tente salvar configurações
- Verifique se não há mais erros 404

### 2. **Sistema To-Do**
- Tente criar uma nova tarefa
- Verifique se não há mais erros de schema

### 3. **Permissões**
- Desabilite uma permissão para um usuário master
- Verifique se a funcionalidade fica inacessível

## Se Ainda Houver Problemas

### Opção 1: Verificar Políticas Existentes
```sql
-- Ver políticas existentes em todo_tasks
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'todo_tasks';

-- Ver políticas existentes em todo_folders
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'todo_folders';
```

### Opção 2: Script Manual (se necessário)
Se ainda houver problemas, posso criar um script que:
1. Remove políticas específicas
2. Recria apenas as políticas problemáticas
3. Mantém as políticas que estão funcionando

## Status Atual

| Problema | Status | Solução |
|----------|--------|---------|
| Tabela user_settings | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Schema todo_tasks | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Permissões de IA | ⏳ Pendente | Execute `fix_essential_only.sql` |
| Políticas RLS | ✅ Mantidas | Não serão alteradas |

## Próximos Passos

1. **Execute `fix_essential_only.sql`** no Supabase
2. **Teste as funcionalidades** mencionadas
3. **Reporte qualquer problema** que ainda persista

---

**Nota:** Este script é seguro e não interfere com configurações existentes de segurança. 
 
 