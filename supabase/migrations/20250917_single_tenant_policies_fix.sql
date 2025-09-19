-- Torna SELECT realmente compartilhado em modo single-tenant
-- 1) Desativa FORCE RLS (se houver)
-- 2) Remove políticas de SELECT restritivas antigas
-- 3) Garante política permissiva de SELECT para authenticated

begin;

-- 1) Desativar FORCE RLS (se configurado) nas tabelas relevantes
alter table if exists public.test_plans            no force row level security;
alter table if exists public.test_cases            no force row level security;
alter table if exists public.test_executions       no force row level security;
alter table if exists public.requirements          no force row level security;
alter table if exists public.defects               no force row level security;
alter table if exists public.requirements_cases    no force row level security;
alter table if exists public.projects              no force row level security;

-- 2) Dropar políticas antigas de SELECT que não sejam as novas (st_select_all_...)
-- Obs: pg_policies.permissive = false indica política RESTRICTIVE (AND)
do $$
declare r record;
begin
  for r in (
    select policyname, schemaname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('test_plans','test_cases','test_executions','requirements','defects','requirements_cases','projects')
      and policyname not like 'st_select_all_%'
      and cmd = 'select'
  ) loop
    execute format('drop policy "%I" on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end$$;

-- 3) Garantir política SELECT permissiva para authenticated em todas as tabelas alvo (inclui projects)
-- (idempotente)

-- helper para criar política se não existir
-- test_plans
alter table if exists public.test_plans enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='test_plans' and policyname='st_select_all_test_plans'
  ) then
    execute 'create policy "st_select_all_test_plans" on public.test_plans for select to authenticated using (true)';
  end if;
end $$;

-- test_cases
alter table if exists public.test_cases enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='test_cases' and policyname='st_select_all_test_cases'
  ) then
    execute 'create policy "st_select_all_test_cases" on public.test_cases for select to authenticated using (true)';
  end if;
end $$;

-- test_executions
alter table if exists public.test_executions enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='test_executions' and policyname='st_select_all_test_executions'
  ) then
    execute 'create policy "st_select_all_test_executions" on public.test_executions for select to authenticated using (true)';
  end if;
end $$;

-- requirements
alter table if exists public.requirements enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='requirements' and policyname='st_select_all_requirements'
  ) then
    execute 'create policy "st_select_all_requirements" on public.requirements for select to authenticated using (true)';
  end if;
end $$;

-- defects
alter table if exists public.defects enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='defects' and policyname='st_select_all_defects'
  ) then
    execute 'create policy "st_select_all_defects" on public.defects for select to authenticated using (true)';
  end if;
end $$;

-- requirements_cases
alter table if exists public.requirements_cases enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='requirements_cases' and policyname='st_select_all_requirements_cases'
  ) then
    execute 'create policy "st_select_all_requirements_cases" on public.requirements_cases for select to authenticated using (true)';
  end if;
end $$;

-- projects (incluído para que todos vejam os projetos criados)
alter table if exists public.projects enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='st_select_all_projects'
  ) then
    execute 'create policy "st_select_all_projects" on public.projects for select to authenticated using (true)';
  end if;
end $$;

commit;
