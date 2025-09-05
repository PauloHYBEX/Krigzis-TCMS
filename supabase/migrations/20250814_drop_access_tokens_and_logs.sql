-- Migration: Remoção do subsistema legado de Tokens/Logs
-- Data: 2025-08-14
-- Descrição: Remove tabelas, funções, triggers e políticas relacionadas a access_tokens e access_logs
-- Objetivo: limpeza de componentes obsoletos sem impactar o build do app

BEGIN;

-- 1) Remover trigger de atualização de updated_at (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_access_tokens_updated_at'
      AND c.relname = 'access_tokens'
  ) THEN
    EXECUTE 'DROP TRIGGER update_access_tokens_updated_at ON public.access_tokens;';
  END IF;
END $$;

-- 2) Remover políticas RLS (se existirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_tokens'
      AND policyname = 'Users can view tokens of their organizations'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view tokens of their organizations" ON public.access_tokens;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_tokens'
      AND policyname = 'Organization masters can manage tokens'
  ) THEN
    EXECUTE 'DROP POLICY "Organization masters can manage tokens" ON public.access_tokens;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_logs'
      AND policyname = 'Users can view logs of their organizations'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view logs of their organizations" ON public.access_logs;';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'access_logs'
      AND policyname = 'System can insert logs'
  ) THEN
    EXECUTE 'DROP POLICY "System can insert logs" ON public.access_logs;';
  END IF;
END $$;

-- 3) Remover funções PL/pgSQL (se existirem)
DROP FUNCTION IF EXISTS public.cleanup_expired_tokens() CASCADE;
DROP FUNCTION IF EXISTS public.validate_and_use_token(VARCHAR, VARCHAR, INET, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_access_token(UUID, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.generate_access_token() CASCADE;

-- 4) Remover tabelas (remova logs primeiro por FK para tokens)
DROP TABLE IF EXISTS public.access_logs CASCADE;
DROP TABLE IF EXISTS public.access_tokens CASCADE;

COMMIT;
