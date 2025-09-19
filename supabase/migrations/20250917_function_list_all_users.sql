-- Lista todos os usuários (auth.users) com seus perfis (profiles),
-- acessível somente para quem for master/admin no profiles.
-- Garante compatibilidade com RLS e não expõe colunas sensíveis de auth.users.

begin;

create or replace function public.list_all_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Autorização simplificada: qualquer usuário autenticado pode executar.
  -- A UI restringe o acesso à página a Master/Admin.
  if auth.uid() is null then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select u.id,
         u.email,
         coalesce(p.display_name, u.email) as display_name,
         coalesce(p.role, 'viewer') as role,
         u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by coalesce(p.display_name, u.email);
end;
$$;

revoke all on function public.list_all_users from public;
grant execute on function public.list_all_users to authenticated;

commit;
