-- Single-tenant: permitir leitura (SELECT) para todos os usuários autenticados
-- em todas as tabelas funcionais, garantindo que qualquer usuário veja os mesmos dados.
-- Esta migration é idempotente (só cria políticas se não existirem)

begin;

-- test_plans
alter table if exists public.test_plans enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'test_plans' and policyname = 'st_select_all_test_plans'
  ) then
    execute 'create policy "st_select_all_test_plans" on public.test_plans for select to authenticated using (true)';
  end if;
end$$;

-- test_cases
alter table if exists public.test_cases enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'test_cases' and policyname = 'st_select_all_test_cases'
  ) then
    execute 'create policy "st_select_all_test_cases" on public.test_cases for select to authenticated using (true)';
  end if;
end$$;

-- test_executions
alter table if exists public.test_executions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'test_executions' and policyname = 'st_select_all_test_executions'
  ) then
    execute 'create policy "st_select_all_test_executions" on public.test_executions for select to authenticated using (true)';
  end if;
end$$;

-- requirements
alter table if exists public.requirements enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'requirements' and policyname = 'st_select_all_requirements'
  ) then
    execute 'create policy "st_select_all_requirements" on public.requirements for select to authenticated using (true)';
  end if;
end$$;

-- defects
alter table if exists public.defects enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'defects' and policyname = 'st_select_all_defects'
  ) then
    execute 'create policy "st_select_all_defects" on public.defects for select to authenticated using (true)';
  end if;
end$$;

-- requirements_cases (tabela de junção)
alter table if exists public.requirements_cases enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'requirements_cases' and policyname = 'st_select_all_requirements_cases'
  ) then
    execute 'create policy "st_select_all_requirements_cases" on public.requirements_cases for select to authenticated using (true)';
  end if;
end$$;

commit;
