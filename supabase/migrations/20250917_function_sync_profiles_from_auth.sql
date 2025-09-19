-- Sincroniza perfis ausentes a partir de auth.users
-- Cria linhas mínimas em public.profiles e garante user_permissions para cada usuário

begin;

create or replace function public.sync_profiles_from_auth()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- Inserir perfis ausentes
  insert into public.profiles (id, email, display_name, role)
  select u.id, u.email, coalesce(p.display_name, split_part(u.email, '@', 1)) as display_name, coalesce(p.role, 'viewer') as role
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null;

  -- Garantir entradas em user_permissions
  insert into public.user_permissions (user_id)
  select u.id
  from auth.users u
  left join public.user_permissions up on up.user_id = u.id
  where up.user_id is null;
end;
$$;

revoke all on function public.sync_profiles_from_auth from public;
grant execute on function public.sync_profiles_from_auth to authenticated;

commit;
