# Instruções de Correção - TestMaster AI

## Problemas Identificados e Soluções

### 1. **Tabela `user_settings` não existe** ❌
**Erro:** `Failed to load resource: the server responded with a status of 404 ()`
**Causa:** A tabela `user_settings` não foi criada no banco de dados
**Solução:** Execute o script SQL de correção

### 2. **Schema da tabela `todo_tasks` incorreto** ❌
**Erro:** `Could not find the 'user_id' column of 'todo_tasks' in the schema cache`
**Causa:** A tabela `todo_tasks` está usando `created_by` em vez de `user_id`
**Solução:** Execute o script SQL de correção

### 3. **Permissões não funcionando corretamente** ❌
**Erro:** Usuário master ainda tem acesso mesmo com permissões desabilitadas
**Causa:** A função `hasPermission` estava dando acesso total para masters/admins
**Solução:** ✅ **Já corrigido** - Agora apenas permissões críticas de administração são sempre concedidas

### 4. **Warning do React Fragment** ⚠️
**Erro:** `Invalid prop 'data-lov-id' supplied to 'React.Fragment'`
**Causa:** React Fragment recebendo props inválidas
**Solução:** ✅ **Já corrigido** - Substituído por div

## Como Executar as Correções

### Passo 1: Executar Script SQL
1. Acesse o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o script `fix_all_errors.sql` que foi criado
4. Verifique se todas as mensagens de sucesso aparecem

### Passo 2: Verificar Correções
Após executar o script, verifique se:

1. **Tabela user_settings foi criada:**
   ```sql
   SELECT * FROM user_settings LIMIT 1;
   ```

2. **Coluna user_id existe em todo_tasks:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'todo_tasks' AND column_name = 'user_id';
   ```

3. **Permissões de IA foram adicionadas:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'user_permissions' 
   AND column_name LIKE '%ai%';
   ```

### Passo 3: Testar Funcionalidades
1. **MCP (Model Control Panel):**
   - Tente salvar configurações
   - Verifique se não há mais erros 404

2. **Sistema To-Do:**
   - Tente criar uma nova tarefa
   - Verifique se não há mais erros de schema

3. **Permissões:**
   - Desabilite uma permissão para um usuário master
   - Verifique se a funcionalidade fica inacessível

## Script SQL de Correção

O arquivo `fix_all_errors.sql` contém todas as correções necessárias:

- ✅ Cria tabela `user_settings` se não existir
- ✅ Corrige schema das tabelas `todo_tasks` e `todo_folders`
- ✅ Adiciona permissões de IA faltantes
- ✅ Atualiza políticas RLS
- ✅ Configura permissões padrão para usuários master

## Verificação Final

Após executar todas as correções, você deve ver:

1. ✅ **MCP funcionando** - Configurações salvam sem erro 404
2. ✅ **To-Do funcionando** - Tarefas criam sem erro de schema
3. ✅ **Permissões funcionando** - Desabilitar permissões realmente bloqueia acesso
4. ✅ **Sem warnings** - Console limpo sem erros de React Fragment

## Se Ainda Houver Problemas

1. **Verifique logs do Supabase** para erros específicos
2. **Limpe cache do navegador** e recarregue a página
3. **Verifique se todas as migrações foram aplicadas** no Supabase
4. **Execute o script SQL novamente** se necessário

## Contato

Se ainda houver problemas após seguir estas instruções, forneça:
- Screenshots dos erros no console
- Logs específicos do Supabase
- Descrição detalhada do que não está funcionando 

## Problemas Identificados e Soluções

### 1. **Tabela `user_settings` não existe** ❌
**Erro:** `Failed to load resource: the server responded with a status of 404 ()`
**Causa:** A tabela `user_settings` não foi criada no banco de dados
**Solução:** Execute o script SQL de correção

### 2. **Schema da tabela `todo_tasks` incorreto** ❌
**Erro:** `Could not find the 'user_id' column of 'todo_tasks' in the schema cache`
**Causa:** A tabela `todo_tasks` está usando `created_by` em vez de `user_id`
**Solução:** Execute o script SQL de correção

### 3. **Permissões não funcionando corretamente** ❌
**Erro:** Usuário master ainda tem acesso mesmo com permissões desabilitadas
**Causa:** A função `hasPermission` estava dando acesso total para masters/admins
**Solução:** ✅ **Já corrigido** - Agora apenas permissões críticas de administração são sempre concedidas

### 4. **Warning do React Fragment** ⚠️
**Erro:** `Invalid prop 'data-lov-id' supplied to 'React.Fragment'`
**Causa:** React Fragment recebendo props inválidas
**Solução:** ✅ **Já corrigido** - Substituído por div

## Como Executar as Correções

### Passo 1: Executar Script SQL
1. Acesse o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o script `fix_all_errors.sql` que foi criado
4. Verifique se todas as mensagens de sucesso aparecem

### Passo 2: Verificar Correções
Após executar o script, verifique se:

1. **Tabela user_settings foi criada:**
   ```sql
   SELECT * FROM user_settings LIMIT 1;
   ```

2. **Coluna user_id existe em todo_tasks:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'todo_tasks' AND column_name = 'user_id';
   ```

3. **Permissões de IA foram adicionadas:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'user_permissions' 
   AND column_name LIKE '%ai%';
   ```

### Passo 3: Testar Funcionalidades
1. **MCP (Model Control Panel):**
   - Tente salvar configurações
   - Verifique se não há mais erros 404

2. **Sistema To-Do:**
   - Tente criar uma nova tarefa
   - Verifique se não há mais erros de schema

3. **Permissões:**
   - Desabilite uma permissão para um usuário master
   - Verifique se a funcionalidade fica inacessível

## Script SQL de Correção

O arquivo `fix_all_errors.sql` contém todas as correções necessárias:

- ✅ Cria tabela `user_settings` se não existir
- ✅ Corrige schema das tabelas `todo_tasks` e `todo_folders`
- ✅ Adiciona permissões de IA faltantes
- ✅ Atualiza políticas RLS
- ✅ Configura permissões padrão para usuários master

## Verificação Final

Após executar todas as correções, você deve ver:

1. ✅ **MCP funcionando** - Configurações salvam sem erro 404
2. ✅ **To-Do funcionando** - Tarefas criam sem erro de schema
3. ✅ **Permissões funcionando** - Desabilitar permissões realmente bloqueia acesso
4. ✅ **Sem warnings** - Console limpo sem erros de React Fragment

## Se Ainda Houver Problemas

1. **Verifique logs do Supabase** para erros específicos
2. **Limpe cache do navegador** e recarregue a página
3. **Verifique se todas as migrações foram aplicadas** no Supabase
4. **Execute o script SQL novamente** se necessário

## Contato

Se ainda houver problemas após seguir estas instruções, forneça:
- Screenshots dos erros no console
- Logs específicos do Supabase
- Descrição detalhada do que não está funcionando 

## Problemas Identificados e Soluções

### 1. **Tabela `user_settings` não existe** ❌
**Erro:** `Failed to load resource: the server responded with a status of 404 ()`
**Causa:** A tabela `user_settings` não foi criada no banco de dados
**Solução:** Execute o script SQL de correção

### 2. **Schema da tabela `todo_tasks` incorreto** ❌
**Erro:** `Could not find the 'user_id' column of 'todo_tasks' in the schema cache`
**Causa:** A tabela `todo_tasks` está usando `created_by` em vez de `user_id`
**Solução:** Execute o script SQL de correção

### 3. **Permissões não funcionando corretamente** ❌
**Erro:** Usuário master ainda tem acesso mesmo com permissões desabilitadas
**Causa:** A função `hasPermission` estava dando acesso total para masters/admins
**Solução:** ✅ **Já corrigido** - Agora apenas permissões críticas de administração são sempre concedidas

### 4. **Warning do React Fragment** ⚠️
**Erro:** `Invalid prop 'data-lov-id' supplied to 'React.Fragment'`
**Causa:** React Fragment recebendo props inválidas
**Solução:** ✅ **Já corrigido** - Substituído por div

## Como Executar as Correções

### Passo 1: Executar Script SQL
1. Acesse o **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Execute o script `fix_all_errors.sql` que foi criado
4. Verifique se todas as mensagens de sucesso aparecem

### Passo 2: Verificar Correções
Após executar o script, verifique se:

1. **Tabela user_settings foi criada:**
   ```sql
   SELECT * FROM user_settings LIMIT 1;
   ```

2. **Coluna user_id existe em todo_tasks:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'todo_tasks' AND column_name = 'user_id';
   ```

3. **Permissões de IA foram adicionadas:**
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'user_permissions' 
   AND column_name LIKE '%ai%';
   ```

### Passo 3: Testar Funcionalidades
1. **MCP (Model Control Panel):**
   - Tente salvar configurações
   - Verifique se não há mais erros 404

2. **Sistema To-Do:**
   - Tente criar uma nova tarefa
   - Verifique se não há mais erros de schema

3. **Permissões:**
   - Desabilite uma permissão para um usuário master
   - Verifique se a funcionalidade fica inacessível

## Script SQL de Correção

O arquivo `fix_all_errors.sql` contém todas as correções necessárias:

- ✅ Cria tabela `user_settings` se não existir
- ✅ Corrige schema das tabelas `todo_tasks` e `todo_folders`
- ✅ Adiciona permissões de IA faltantes
- ✅ Atualiza políticas RLS
- ✅ Configura permissões padrão para usuários master

## Verificação Final

Após executar todas as correções, você deve ver:

1. ✅ **MCP funcionando** - Configurações salvam sem erro 404
2. ✅ **To-Do funcionando** - Tarefas criam sem erro de schema
3. ✅ **Permissões funcionando** - Desabilitar permissões realmente bloqueia acesso
4. ✅ **Sem warnings** - Console limpo sem erros de React Fragment

## Se Ainda Houver Problemas

1. **Verifique logs do Supabase** para erros específicos
2. **Limpe cache do navegador** e recarregue a página
3. **Verifique se todas as migrações foram aplicadas** no Supabase
4. **Execute o script SQL novamente** se necessário

## Contato

Se ainda houver problemas após seguir estas instruções, forneça:
- Screenshots dos erros no console
- Logs específicos do Supabase
- Descrição detalhada do que não está funcionando 
 
 