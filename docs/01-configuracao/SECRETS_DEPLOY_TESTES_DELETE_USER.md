# Remoção Segura de Usuários — Secrets, Deploy e Testes

Este guia consolida como configurar secrets, fazer deploy das Edge Functions `invite-user` e `delete-user`, e testar o fluxo de remoção segura, incluindo rollback. Aplica-se ao projeto com `project_id` (ref) `mhhzdykyjgrnprcyhlbz` conforme `supabase/config.toml`.

## 1) Requisitos

- Supabase CLI instalado e autenticado
- Acesso ao projeto Supabase (org/projeto)
- Chaves do projeto:
  - SUPABASE_URL (Dashboard: Project Settings → API → Project URL)
  - SUPABASE_ANON_KEY (Dashboard: Project Settings → API → anon public)
  - SUPABASE_SERVICE_ROLE_KEY (Dashboard: Project Settings → API → service_role)

## 2) Login no Supabase CLI

```powershell
supabase login
# Cole seu access token (https://supabase.com/dashboard/account/tokens)
```

## 3) Configurar Secrets das Edge Functions

As funções `invite-user` e `delete-user` exigem as mesmas variáveis. Configure-as no escopo de Functions do projeto:

```powershell
# Substitua os valores pelos do seu projeto
$PROJECT_REF = "mhhzdykyjgrnprcyhlbz"

supabase functions secrets set \
  --project-ref $PROJECT_REF \
  SUPABASE_URL="https://$PROJECT_REF.supabase.co" \
  SUPABASE_ANON_KEY="<SUA_ANON_KEY>" \
  SUPABASE_SERVICE_ROLE_KEY="<SUA_SERVICE_ROLE_KEY>" \
  INVITE_REDIRECT_URL="http://localhost:8080"
```

Para revisar:
```powershell
supabase functions secrets list --project-ref $PROJECT_REF
```

## 4) Deploy das Edge Functions

```powershell
$PROJECT_REF = "mhhzdykyjgrnprcyhlbz"

# Deploy individual
supabase functions deploy invite-user --project-ref $PROJECT_REF
supabase functions deploy delete-user --project-ref $PROJECT_REF

# (Opcional) Ver logs recentes
supabase functions logs --project-ref $PROJECT_REF --function delete-user
```

## 5) Testes (HTTP)

A função `delete-user` valida o JWT do usuário chamador e exige papel global `master`. Use um Access Token de uma sessão ativa (não a service role). No frontend, isso já ocorre via `supabase.functions.invoke`.

Testes via cURL (substitua placeholders):

- Hard delete (remoção completa):
```bash
curl -X POST \
  "https://mhhzdykyjgrnprcyhlbz.functions.supabase.co/delete-user" \
  -H "Authorization: Bearer <ACCESS_TOKEN_USUARIO_MASTER>" \
  -H "apikey: <SUA_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<UUID_DO_USUARIO_ALVO>"
  }'
```

- Remoção por organização (apenas desvincula e limpa permissões da org):
```bash
curl -X POST \
  "https://mhhzdykyjgrnprcyhlbz.functions.supabase.co/delete-user" \
  -H "Authorization: Bearer <ACCESS_TOKEN_USUARIO_MASTER>" \
  -H "apikey: <SUA_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<UUID_DO_USUARIO_ALVO>",
    "organization_id": "<UUID_DA_ORGANIZACAO>",
    "hard_delete": false
  }'
```

### 5.1) Teste do invite-user (fallback: e-mail de recuperação; link só se e-mail falhar)

Quando o e-mail já existe no Auth, a função `invite-user` agora PRIORITIZA o envio de um e-mail de recuperação de senha ao usuário (via `auth.resetPasswordForEmail`).

- Se o envio for bem-sucedido, a resposta inclui `email_sent_via: "password_reset"` e NENHUM link é retornado na API (não exibimos links no frontend por segurança).
- Somente se o envio do e-mail falhar por problema de redirect/whitelist (ex.: URL não permitida) é que o fallback retorna `recovery_link` ou `magiclink` para uso administrativo.

Lembretes de configuração (obrigatórios para evitar cair no fallback de link):
- Auth → URL Configuration: `site_url = http://localhost:8080`
- Auth → Redirect URLs: adicionar `http://localhost:8080/reset-password`
- Secret da Function: `INVITE_REDIRECT_URL="http://localhost:8080"`

Exemplo de teste com e-mail JÁ existente:

```bash
curl -X POST \
  "https://mhhzdykyjgrnprcyhlbz.functions.supabase.co/invite-user" \
  -H "Authorization: Bearer <ACCESS_TOKEN_USUARIO_MASTER>" \
  -H "apikey: <SUA_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "email-ja-existente@dominio.com"
  }'
```

Resposta esperada (caso e-mail enviado):

```json
{
  "success": true,
  "message": "Usuário já existia. E-mail de recuperação enviado.",
  "email_sent_via": "password_reset"
}
```

Caso haja erro de redirect e o e-mail NÃO possa ser enviado, a função retorna um link administrativo:

```json
{
  "success": true,
  "message": "Usuário já existia. Link de recuperação gerado.",
  "recovery_link": "https://...",
  "link_type": "recovery"
}
```

Respostas esperadas:
- 200 OK em sucesso, com `mode: "hard_delete"` ou `mode: "org_cleanup"`
- 400/403/401 em erros de validação (ex.: tentar remover a si mesmo; remover único Master global; remover último Master de uma org; não autenticado; não master)

## 6) Fluxo no Frontend

O componente `src/pages/UserManagement.tsx`:
- Exibe modal de confirmação (`AlertDialog`) controlado por `isDeleteModalOpen` e `userToDelete`.
- Chama `supabase.functions.invoke('delete-user', { body: { user_id } })` em `confirmDeleteUser()`.
- Mostra toasts, controla `deleteLoading` e faz `fetchUsers()` após sucesso.

## 7) Rollback

- Se foi remoção por organização (hard_delete=false):
  - Recriar vínculo na tabela `organization_members` (papel adequado)
  - Reaplicar permissões em `user_permissions`

- Se foi hard delete:
  - O usuário foi removido do Auth e dados de `profiles`/`user_permissions`/`organization_members` foram excluídos. O rollback consiste em:
    1) Convidar novamente o usuário via `invite-user`
    2) Após onboarding, ajustar papel com RPC `set_user_role`
    3) Ajustar permissões com RPC `set_user_permissions`

## 8) Troubleshooting

- 401 Não autenticado: verifique o `Authorization: Bearer <ACCESS_TOKEN>`
- 403 Acesso negado: apenas `master` pode remover
- 400 Bloqueios de segurança: não é possível remover o único Master global nem o último Master de qualquer organização
- 500 Configuração ausente: confirme os secrets nas functions

## 9) Segurança

- Não exponha a `SUPABASE_SERVICE_ROLE_KEY` no frontend. Ela fica apenas como secret da Function.
- A Edge Function já impede auto-remoção e últimos masters (global/org).

---

Checklist rápido:
- [ ] CLI logado (`supabase login`)
- [ ] Secrets setados (URL, anon, service role)
- [ ] Functions deployadas (`invite-user`, `delete-user`)
- [ ] Testes de fluxo OK (incluindo erros esperados)
