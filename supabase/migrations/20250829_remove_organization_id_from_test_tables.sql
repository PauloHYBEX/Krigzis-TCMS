-- Migration: Remover organization_id das tabelas de teste
-- Data: 2025-08-29
-- Descrição: Remove colunas, índices e políticas (se existirem) que referenciam organization_id em test_plans, test_cases, test_executions.

BEGIN;

-- 1) Remover TODAS as políticas RLS das tabelas de teste (defensivo e compatível)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- test_plans
  FOR r IN (
    SELECT p.polname
    FROM pg_policy p
    WHERE p.polrelid = 'public.test_plans'::regclass
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.test_plans', r.polname);
  END LOOP;

  -- test_cases
  FOR r IN (
    SELECT p.polname
    FROM pg_policy p
    WHERE p.polrelid = 'public.test_cases'::regclass
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.test_cases', r.polname);
  END LOOP;

  -- test_executions
  FOR r IN (
    SELECT p.polname
    FROM pg_policy p
    WHERE p.polrelid = 'public.test_executions'::regclass
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.test_executions', r.polname);
  END LOOP;
END $$;

-- 2) Remover índices por nome, se existirem
DO $$
BEGIN
  -- test_plans
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_test_plans_organization_id' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_test_plans_organization_id';
  END IF;

  -- test_cases
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_test_cases_organization_id' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_test_cases_organization_id';
  END IF;

  -- test_executions
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'idx_test_executions_organization_id' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.idx_test_executions_organization_id';
  END IF;
END $$;

-- 3) Remover colunas organization_id (inclui remoção de FKs atreladas)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'test_plans' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_plans DROP COLUMN IF EXISTS organization_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'test_cases' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_cases DROP COLUMN IF EXISTS organization_id';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'test_executions' AND column_name = 'organization_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_executions DROP COLUMN IF EXISTS organization_id';
  END IF;
END $$;

COMMIT;
