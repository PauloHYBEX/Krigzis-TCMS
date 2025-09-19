# SQL — Banco de Dados (Supabase)

Este documento unifica todo o conteúdo de configuração e operação do banco para o Krigzis‑TCMS em um único lugar.

Abrange:
- Preparação do projeto Supabase
- Execução do SQL de criação/ajuste de schema
- RLS e permissões
- Scripts e migrações disponíveis
- Verificações e troubleshooting

Fontes consolidadas: `docs/01-configuracao/CONFIGURACAO_SUPABASE.md`, `docs/01-configuracao/RESUMO_CONFIGURACAO.md`, diretório `docs/02-banco-dados/` e instruções correlatas em diagnósticos.

## 1. Pré‑requisitos

- Projeto Supabase criado.
- Acesso ao Dashboard do Supabase.
- (Opcional) Supabase CLI instalado e autenticado.

Variáveis de ambiente na aplicação (arquivo `.env.local`):
```env
VITE_SUPABASE_URL=https://<seu-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```

## 2. Setup inicial — Executar SQL

1) Abra o Supabase Dashboard → SQL → New Query.
2) Cole e execute o SQL principal (schema + RLS + triggers). Você pode optar por:
- Usar os trechos e instruções consolidados NESTE guia.
- Ou aplicar as migrações oficiais do repositório em `supabase/migrations/` (recomendado para evolução contínua).

Após executar, você deve ter (exemplos):
- Tabelas: `profiles`, `user_permissions`, `test_plans`, `test_cases`, `test_executions`, `user_settings`, `todo_folders`, `todo_items` (nomes variam conforme versão).
- RLS habilitado nas tabelas críticas.
- Triggers de `updated_at` ativas.

## 3. Autenticação e URLs

Dashboard → Authentication → Settings:
- Site URL: `http://localhost:8080`
- Redirect URLs: `http://localhost:8080/**`

## 4. RLS e Permissões

- RLS ativado em tabelas de usuários, testes e TODO.
- Políticas padrão permitem que usuários acessem apenas seus próprios registros ou os da organização (onde aplicável).
- Consulte as migrações em `supabase/migrations/` como fonte de verdade para evolução do schema e RLS.

## 5. Migrações oficiais (supabase/migrations/)

Prefira aplicar as migrações versionadas em `supabase/migrations/` para manter consistência entre ambientes. Se necessário, os trechos SQL deste guia podem ser usados como referência rápida.

## 6. Verificações rápidas (SQL)

```sql
-- Verificar tabelas essenciais
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','user_permissions','test_plans','test_cases','test_executions',
    'todo_folders','todo_items','user_settings'
  );

-- Conferir RLS ligado
SELECT relname AS table, relrowsecurity AS rls
FROM pg_class WHERE relkind='r' AND relnamespace = 'public'::regnamespace;
```

## 7. Troubleshooting rápido

- Erro 404/403 ao salvar configurações:
  - Execute o setup SQL completo primeiro.
  - Garanta que `user_settings` existe.
- "relation does not exist":
  - Reexecute o SQL de setup e confirme o schema.
- Violações RLS:
  - Confira políticas para a tabela afetada; ajuste conforme as consultas reais da aplicação.

## 8. CLI (opcional)

```powershell
supabase login
supabase link --project-ref <seu-ref>
# Secrets comuns das Edge Functions (se usar):
supabase functions secrets set \
  --project-ref <seu-ref> \
  SUPABASE_URL="https://<seu-ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon>" \
  SUPABASE_SERVICE_ROLE_KEY="<service>"
```

## 9. Pós‑setup — Executando a aplicação

1) `npm install`
2) Preencha `.env.local` (acima).
3) `npm run dev` (porta 8080 por padrão) e navegue na aplicação.

---

Changelog deste guia: versão 1.0 (consolidação inicial).
