# Especificação Funcional e Técnica: Krigzis-TCMS

## 1. Visão Geral e Objetivos

### 1.1. Resumo do Projeto

O Krigzis-TCMS é um sistema de gestão de casos de teste (TCMS - Test Case Management System) moderno, desenvolvido para otimizar o ciclo de vida de testes de software. A plataforma incorpora funcionalidades avançadas, como a geração de conteúdo por Inteligência Artificial, para aumentar a produtividade e a eficiência das equipes de qualidade.

O projeto segue uma abordagem de desenvolvimento incremental, focada em entregar valor de forma contínua, partindo de um MVP (Minimum Viable Product) sólido para evoluir com funcionalidades avançadas.

### 1.2. Objetivos de Negócio

- **Centralizar a Gestão de Testes:** Oferecer um local único para criar, gerenciar e rastrear planos de teste, casos de teste e execuções.
- **Aumentar a Eficiência:** Reduzir o tempo de criação de casos de teste através da integração com múltiplos provedores de IA.
- **Melhorar a Tomada de Decisão:** Fornecer dashboards e relatórios com métricas em tempo real sobre o progresso e a qualidade dos testes.
- **Garantir a Segurança e Escalabilidade:** Utilizar uma arquitetura robusta, multi-tenant e segura para atender desde pequenas equipes a grandes organizações.
- **Integrar Teste e Gestão de Tarefas:** Conectar o fluxo de testes com um sistema de tarefas (TODO) para um gerenciamento de trabalho coeso.

## 2. Arquitetura e Stack Tecnológica

O sistema é construído sobre uma stack moderna, separando as responsabilidades entre o frontend e o backend (BaaS).

- **Frontend:**
  - **Framework:** React 18.3+ com TypeScript
  - **Build Tool:** Vite
  - **Estilização:** Tailwind CSS com `shadcn/ui` e Radix UI para componentes acessíveis.
  - **Gerenciamento de Estado:** React Query para o estado do servidor.
  - **Roteamento:** React Router.

- **Backend (BaaS - Backend as a Service):**
  - **Plataforma:** Supabase
  - **Banco de Dados:** PostgreSQL
  - **Autenticação:** Supabase Auth
  - **Segurança:** Row Level Security (RLS) para controle de acesso granular.
  - **APIs e Funções Serverless:** Supabase Edge Functions.

- **Integrações de IA:**
  - **Provedores Suportados:** Google Gemini, OpenAI, Anthropic, Groq, e Ollama (local).
  - **Gerenciamento:** Painel de Controle de Modelos (MCP) para configuração de chaves de API e templates de prompt.

## 3. Modelo de Dados (Entidades e Relacionamentos)

O banco de dados é estruturado para suportar uma arquitetura multi-tenant e modular. As entidades principais são:

### 3.1. Módulo de Organização e Acesso

- **`organizations`**: Entidade central para o multi-tenancy. Cada organização é um inquilino isolado no sistema.
- **`profiles`**: Armazena informações públicas dos usuários, vinculadas ao `auth.users` do Supabase.
- **`organization_members`**: Tabela de junção que associa usuários a organizações, definindo seu papel (`user_role`) e status.
- **`user_permissions`**: Tabela granular que define as permissões específicas de um usuário dentro de uma organização (ex: `can_manage_cases`, `can_use_ai`).

### 3.2. Módulo de Gestão de Testes (TCMS)

- **`test_plans`**: Planos de teste que agrupam casos de teste com um objetivo comum. Contém campos como escopo, abordagem, riscos e critérios.
- **`test_cases`**: Casos de teste individuais, com título, descrição, passos, resultado esperado, prioridade e status. Vinculados a um `test_plan`.
- **`test_executions`**: Registros da execução de um `test_case`, contendo o status (ex: `passed`, `failed`), notas e o responsável pela execução.

### 3.3. Módulo de Gestão de Tarefas (TODO)

- **`todo_folders`**: Permite organizar tarefas em pastas hierárquicas.
- **`todo_tasks`**: A unidade de trabalho principal. Uma tarefa pode ter descrição, prioridade, status, datas, e pode ser vinculada a entidades do TCMS (`test_plans`, `test_cases`).
- **`todo_subtasks`**: Sub-tarefas para dividir uma `todo_task` principal em passos menores.
- **`todo_comments`**: Sistema de comentários para as tarefas.
- **`todo_attachments`**: Permite anexar arquivos às tarefas, com upload para o Supabase Storage.
- **`todo_templates`**: Permite criar templates de tarefas para reutilização.

## 4. Módulos e Funcionalidades Principais

### 4.1. Autenticação e Gestão de Usuários
- Login, cadastro e recuperação de senha gerenciados pelo Supabase Auth.
- Usuários podem pertencer a uma ou mais organizações com diferentes níveis de permissão.
- Convite de novos membros para uma organização.

### 4.2. Dashboard e Relatórios
- Painel principal com uma visão geral do status das execuções de teste.
- Gráficos e métricas sobre a cobertura de testes, taxas de sucesso/falha e progresso geral.

### 4.3. Gestão de Planos e Casos de Teste
- CRUD completo para Planos de Teste.
- CRUD completo para Casos de Teste, associados a um plano.
- Interface para visualizar e organizar casos de teste dentro de seus respectivos planos.

### 4.4. Execução de Testes
- Interface para que os testadores executem os casos de teste, atualizando seu status e registrando resultados.
- Histórico de todas as execuções de um caso de teste.

### 4.5. Gerador de Testes com IA (AIGenerator)
- Funcionalidade para gerar automaticamente conteúdo para `test_plans` e `test_cases` usando modelos de linguagem.
- **Painel de Controle de Modelos (MCP):** Área administrativa para configurar provedores de IA, gerenciar chaves de API e testar a conectividade.
- Permite a seleção de diferentes modelos e a personalização de prompts para adaptar a geração de conteúdo às necessidades do projeto.

### 4.6. Gestão de Tarefas (TODO)
- Sistema completo para criar e gerenciar tarefas e subtarefas.
- Organização por pastas, atribuição de responsáveis, definição de prazos e prioridades.
- **Integração com TCMS:** Capacidade de vincular tarefas diretamente a planos, casos ou execuções de teste, facilitando o rastreamento de trabalho relacionado (ex: "Corrigir bug encontrado na execução X" ou "Criar casos de teste para a feature Y").

## 5. Lógica de Negócio e Regras

- **Multi-Tenancy:** Todos os dados de TCMS e TODO são isolados por `organization_id`. Um usuário só pode acessar os dados da organização à qual pertence e tem permissão.
- **Controle de Acesso (RBAC + Permissions):**
  - O acesso é controlado por uma combinação de papéis (`user_role`: master, admin, manager, tester, viewer) e permissões booleanas granulares (`user_permissions`).
  - Exemplo: Um usuário com o papel `tester` pode executar testes, mas não pode criar novos `test_plans` a menos que a permissão `can_manage_plans` seja concedida a ele.
- **Segurança (RLS):** Todas as tabelas críticas possuem políticas de Row Level Security ativadas no PostgreSQL, garantindo que as queries só retornem os dados permitidos para o usuário autenticado.
- **Geração por IA:** A funcionalidade de IA é protegida por permissões (`can_use_ai`, `can_access_model_control`), garantindo que apenas usuários autorizados possam utilizar os modelos e acessar o painel de configuração.

## 6. Roadmap de Desenvolvimento (Baseado no `RESUMO_EXECUTIVO.md`)

O desenvolvimento segue um plano estruturado em fases para garantir a entrega de um sistema funcional e de alta qualidade.

- **Fase 1: Fundação Sólida (Concluída)**
  - Limpeza da estrutura do banco de dados e organização dos arquivos.
  - Definição de um schema SQL limpo e validado.

- **Fase 2: Correção da Base (Em Andamento)**
  - Sincronização dos tipos TypeScript com o banco de dados.
  - Implementação de um sistema de permissões simplificado e funcional.
  - Configuração de políticas RLS básicas.

- **Fase 3: Implementação do Core**
  - Desenvolvimento dos hooks e serviços para CRUD completo das entidades principais.
  - Construção dos componentes de UI e páginas para as funcionalidades de TCMS e TODO.

- **Fase 4: Funcionalidades Avançadas**
  - Implementação do sistema de anexos em tarefas.
  - Lógica para subtarefas e templates.

- **Fase 5: Integração e Qualidade**
  - Refinamento da integração entre os módulos de Teste e TODO.
  - Validação completa do sistema e adição de testes automatizados.
  - Criação de documentação final para o usuário.
