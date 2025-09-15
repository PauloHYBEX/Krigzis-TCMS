# Funções legadas (deprecated)

Estas funções foram descontinuadas e migradas para o cliente (frontend) via `ModelControlService`:

- `generate-with-ai/`
- `generate-batch-plans/`

Motivo: a geração por IA foi centralizada no app cliente para permitir controle via MCP, fallback entre provedores e templates dinâmicos.

Ponto de referência atual:
- Frontend: `src/services/modelControlService.ts`
- Páginas: `src/pages/ModelControlPanel.tsx`, `src/pages/AIGenerator.tsx`

Observação: mantenha este diretório apenas como referência histórica. Novas implementações devem seguir o fluxo do MCP e do serviço de controle de modelos.
