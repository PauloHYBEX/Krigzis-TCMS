# Guia do Sistema — Krigzis-TCMS

Este guia consolida, em um único documento, tudo que você precisa saber para entender e operar o Krigzis‑TCMS.

- Público-alvo: times de QA, desenvolvedores e administradores.
- Abrangência: visão, arquitetura, módulos, permissões, IA (MCP), APIs e fluxos principais.

Referências originais consolidadas: `docs/ESPECIFICACAO_SISTEMA.md`, `docs/00-visao-geral/RESUMO_EXECUTIVO.md`, `docs/04-apis/ENDPOINTS.md`, `docs/05-ia-implementacoes/*`.

## 1. Visão Geral

O Krigzis-TCMS é um sistema de gestão de testes com suporte à IA, construído em React + TypeScript e Supabase (PostgreSQL + Auth + RLS). A plataforma cobre todo o ciclo de testes: Planos, Casos, Execuções, Relatórios e Traçabilidade, além de geração assistida por IA.

Principais objetivos:
- Centralizar a gestão de testes (Planos/Casos/Execuções) com rastreabilidade.
- Acelerar a criação de conteúdo por IA (múltiplos provedores e modelos).
- Fornecer segurança e escalabilidade (RLS + permissões granulares).

## 2. Arquitetura e Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, `shadcn/ui`, Radix UI.
- Estado: React Query e Context + Hooks (`src/hooks/`).
- Backend (BaaS): Supabase (PostgreSQL, Auth e Edge Functions opcionais).
- IA: Gemini, OpenAI, Anthropic, Groq, Ollama — configurados via MCP.

Estrutura de pastas (alto nível):
```
src/
  components/       # UI, formulários, padrões visuais
  pages/            # Páginas (TestPlans, TestCases, Executions, MCP etc.)
  hooks/            # Autenticação, permissões, IA, utilidades
  services/         # Supabase e serviços de dados
  integrations/     # Clientes de IA e Supabase
  types/            # Tipos TS das entidades
supabase/
  migrations/       # Migrações SQL
  functions/        # Edge Functions (opcional)
```

## 3. Entidades Principais

- TestPlan (`test_plans`): escopo, critérios, objetivos e metadados de planejamento.
- TestCase (`test_cases`): título, descrição, passos (`steps` JSON), prioridade e tipo.
- TestExecution (`test_executions`): status (`passed|failed|blocked|not_tested`), notas e executado por.
- (Planejado) Requirement/Defect e matriz de traçabilidade.

Tipos em `src/types/`. Conversões e normalizações em `src/services/supabaseService.ts`.

## 4. Permissões e Segurança

- Papéis (roles): `master`, `admin`, `manager`, `tester`, `viewer`.
- Permissões granulares em `user_permissions` e no hook `src/hooks/usePermissions.tsx`.
- RLS (Row Level Security) ativo nas tabelas críticas. Ver detalhes no guia SQL.

Política aplicada: masters não têm “passe livre” para tudo — apenas permissões administrativas críticas podem ter override; demais funcionalidades respeitam os flags explícitos. Veja `hasPermission()` em `src/hooks/usePermissions.tsx`.

## 5. IA e o Model Control Panel (MCP)

O MCP é o painel central de IA. Nele, você:
- Configura chaves API por provedor/modelo (armazenamento seguro por usuário).
- Ativa/desativa modelos e define o modelo padrão por tarefa (ex.: `test-plan-generation`).
- Cria e gerencia templates de prompts.
- Testa conectividade dos modelos.

Provedores suportados: Gemini, OpenAI, Anthropic, Groq, Ollama (local). Implementações e decisões em `docs/05-ia-implementacoes/*` (mantidos como referência histórica). O MCP é um ativo do projeto e não deve ser removido.

## 6. Fluxos Principais

- Planos de Teste
  1) Criar/Editar Planos (página `TestPlans`).
  2) Gerar conteúdo com IA opcionalmente (AIGenerator/AIBatch).
  3) Avaliar e versionar (roadmap: versionamento e auditoria).

- Casos de Teste
  1) Criar casos manualmente ou gerar via IA.
  2) Definir `steps` e `expected_result`.
  3) Vincular ao plano (`plan_id`).

- Execuções
  1) Registrar execução para um caso.
  2) Atualizar `status`, `actual_result`, `notes`.
  3) Relatórios e métricas (roadmap).

## 7. APIs e Serviços

A aplicação consome direto o Supabase via `src/services/supabaseService.ts`. Veja:
- `getTestPlans`, `createTestPlan`, `updateTestPlan`, `deleteTestPlan`.
- `getTestCases`, `createTestCase`, `updateTestCase`, `deleteTestCase`.
- `getTestExecutions`, `createTestExecution`, `updateTestExecution`, `deleteTestExecution`.

Integrações IA em `src/integrations/*/`. Planejamento de novas APIs e roadmap em `docs/04-apis/ENDPOINTS.md` (mantido como referência histórica, conteúdo essencial espelhado aqui).

## 8. Padrões de UI/UX e Boas Práticas

- Componentes com estados de loading/empty/erro padronizados.
- Formulários com validações e consistência visual.
- Hooks com tratamento robusto de erros.
- Acessibilidade com Radix (ex.: `DialogHeader`, `DialogTitle`, `DialogDescription`).

## 9. Instalação Rápida

1) `npm install`
2) Configurar `.env.local` com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (veja guia SQL).
3) `npm run dev` (porta 8080 por padrão).

## 10. Onde aprofundar

- Banco de Dados e SQL: `docs/SQL_Banco_de_Dados.md`.
- Histórico e Diagnósticos: `docs/Historico_Desenvolvimento.md`.

---

Changelog deste guia: versão 1.0 (consolidação inicial).
