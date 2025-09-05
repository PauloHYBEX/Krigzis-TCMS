-- Migration: Make test_plans sequence global per user (not per project)
-- Date: 2025-08-30
-- Purpose: Ensure sequential numbering is unique per user across all projects for test_plans.

BEGIN;

-- 1) Backfill sequence per user deterministically by created_at
UPDATE public.test_plans p
SET sequence = sub.seq
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at ASC
         ) AS seq
  FROM public.test_plans
) AS sub
WHERE p.id = sub.id;

-- 2) Replace unique index from (user_id, project_id, sequence) -> (user_id, sequence)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_test_plans_user_project_sequence'
  ) THEN
    EXECUTE 'DROP INDEX public.ux_test_plans_user_project_sequence';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_test_plans_user_sequence
  ON public.test_plans(user_id, sequence)
  WHERE sequence IS NOT NULL;

-- 3) Update trigger function to assign sequence per user with per-user lock
DROP FUNCTION IF EXISTS public.set_test_plans_sequence() CASCADE;
CREATE OR REPLACE FUNCTION public.set_test_plans_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence IS NULL THEN
    -- Serialize increments per user to avoid race conditions
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

    SELECT COALESCE(MAX(sequence), 0) + 1
      INTO NEW.sequence
      FROM public.test_plans
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_test_plans_sequence ON public.test_plans;
CREATE TRIGGER trg_set_test_plans_sequence
BEFORE INSERT ON public.test_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_test_plans_sequence();

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
