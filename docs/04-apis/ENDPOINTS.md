# ENDPOINTS e APIs - Visão Geral

Este documento cataloga as APIs/serviços atualmente utilizados pela aplicação e planeja os que serão criados por fase do roadmap.

Observação: a aplicação consome o banco via Supabase JS (operações em tabelas) e possui integrações diretas com provedores de IA. Funções Edge antigas foram descontinuadas.

## Convenções
- Autenticação: Supabase Auth (user_id em tabelas). As queries filtram por `user_id` quando aplicável.
- Datas: campos ISO (strings) no armazenamento; convertidos para `Date` no frontend.
- Passos (`steps`) em `test_cases`: armazenados como JSON, mapeados para `TestStep[]` no frontend.

## Ambiente e Configuração
- Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (arquivo `.env.local`).
- Chaves de IA: gerenciadas no Model Control Panel, persistidas em `localStorage` (chave `mcp_config`).

---

# APIs Existentes

## Banco de Dados (Supabase) – Serviços em `src/services/supabaseService.ts`

- `getTestPlans(userId)`
  - Tabela: `test_plans`
  - Filtro: `.eq('user_id', userId)`; ordenação por `updated_at DESC`
  - Retorno: `TestPlan[]`

- `createTestPlan(plan)`
  - Tabela: `test_plans`
  - Inserção: objeto sem `id/created_at/updated_at`
  - Retorno: `TestPlan`

- `updateTestPlan(id, updates)`
  - Tabela: `test_plans`
  - Atualiza campos; força `updated_at = now()`
  - Retorno: `TestPlan`

- `deleteTestPlan(id)`
  - Tabela: `test_plans`
  - Exclusão por id

- `getTestCases(userId, planId?)`
  - Tabela: `test_cases`
  - Filtros: `user_id = userId`, opcional `plan_id = planId`
  - Ordenação: `updated_at DESC`
  - Conversões: `steps` (JSON->`TestStep[]`), enums `priority`/`type`
  - Retorno: `TestCase[]`

- `createTestCase(testCase)`
  - Tabela: `test_cases`
  - Inserção: `steps` enviados como JSON
  - Retorno: `TestCase` (converte `steps`/enums)

- `updateTestCase(id, updates)`
  - Tabela: `test_cases`
  - Atualiza campos; `steps` como JSON; `updated_at = now()`
  - Retorno: `TestCase`

- `deleteTestCase(id)`
  - Tabela: `test_cases`

- `getTestExecutions(userId, planId?, caseId?)`
  - Tabela: `test_executions`
  - Filtros: `user_id`, opcional `plan_id`, `case_id`
  - Ordenação: `executed_at DESC`
  - Conversões: enum `status`, `executed_at` para `Date`
  - Retorno: `TestExecution[]`

- `createTestExecution(execution)`
  - Tabela: `test_executions`
  - Retorno: `TestExecution`

- `updateTestExecution(id, updates)`
  - Tabela: `test_executions`
  - Retorno: `TestExecution`

- `deleteTestExecution(id)`
  - Tabela: `test_executions`

## Integrações de IA (`src/integrations/*/client.ts`)

- Gemini (`gemini`)
  - `getGeminiModel(modelName?, task?)` → model instance
  - `generateText(prompt, modelName?, task?)` → `string`
  - `generateStructuredContent<T>(prompt, modelName?, task?)` → `T`
  - `generateTestPlan(...)` → JSON de plano (validado no app)
  - `generateTestCases(testPlan, numCases?, modelName?)` → `any[]`
  - Chave: via Model Control Panel (`localStorage.mcp_config`)

- OpenAI (`openai`)
  - `openAIGenerateText(prompt, model, apiKey?)` → `string`

- Anthropic (`anthropic`)
  - `anthropicGenerateText(prompt, model, apiKey?)` → `string`

- Groq (`groq`)
  - `groqGenerateText(prompt, model, apiKey?)` → `string`

- Ollama (`ollama`)
  - `ollamaGenerateText(prompt, model, baseUrl?)` → `string` (default `http://localhost:11434`)

## Edge Functions (Supabase) – Descontinuadas

- `supabase/functions/generate-with-ai/index.ts` – descontinuada; referência de prompts.
- `supabase/functions/generate-batch-plans/index.ts` – descontinuada.
- Implementação atual: clientes diretos de IA e MCP em `src/pages/ModelControlPanel.tsx`.

---

# Planejamento por Fase (Novas APIs)

## Fase 1 – Requisitos, Defeitos e Traçabilidade

Tabelas propostas:
- `requirements` (id, user_id, title, description, priority, status, created_at, updated_at)
- `requirements_cases` (requirement_id, case_id)
- `defects` (id, user_id, title, description, status, severity, case_id?, execution_id?, created_at, updated_at)

Serviços (frontend) a criar em `supabaseService.ts`:
- Requisitos: `getRequirements`, `createRequirement`, `updateRequirement`, `deleteRequirement`
- Vínculo requisito↔caso: `linkRequirementToCase`, `unlinkRequirementFromCase`, `getRequirementsByCase`, `getCasesByRequirement`
- Defeitos: `getDefects`, `createDefect`, `updateDefect`, `deleteDefect`
- Traçabilidade: `getTraceabilityMatrix(filters)` → métricas de cobertura e listas relacionadas

Exemplos de payloads:
```json
POST requirements
{
  "title": "Login – requisitos funcionais",
  "description": "...",
  "priority": "high",
  "status": "open"
}
```

```json
POST defects
{
  "title": "Erro 500 ao salvar perfil",
  "description": "Stacktrace...",
  "status": "open",
  "severity": "critical",
  "case_id": "uuid-...",
  "execution_id": "uuid-..."
}
```

## Fase 2 – Dashboard/Relatórios, Suites/Agendamentos, Ambientes/Dados
- Tabelas: `suites`, `suites_cases`, `schedules`, `environments`, `datasets`
- Serviços: agregações para KPIs (taxa de sucesso, cobertura por requisito, flakiness)

## Fase 3 – Busca/Tags/Views, Versionamento e Auditoria, API Keys
- Tabelas: `tags`, `entity_tags`, `audit_logs`, `api_keys`
- Serviços: histórico de versões para `test_plans/test_cases` e restauração

## Fase 4 – Módulo de IA (Registro, Monitoramento, Retreinamento)
- Tabelas: `ml_models`, `ml_experiments`, `ml_metrics`, `ml_alerts`
- Endpoints/serviços:
  - Registro de modelos: criar/atualizar versões e métricas
  - Monitoramento: logs estruturados e métricas (latência, acurácia), detecção de drift (W4)
  - Regras de retreinamento (W5): thresholds, triggers e histórico
  - Endpoint de inferência (quando houver backend):

```http
POST /api/v1/windsurf/predict
Request {
  "windSpeed": 12.5,
  "waterConditions": "calm"
}
Response {
  "prediction": "safe",
  "confidence": 0.95
}
```

---

# Notas de Acessibilidade
- Padronizar uso de `DialogHeader`, `DialogTitle` e `DialogDescription` (Radix) em todos os modais.

# Changelog
- v0.1 (Fase 1 – inicial): documentados serviços existentes, integrações de IA e plano das novas APIs por fase.
