-- Migration: Make test_cases sequence global per user (not per project)
-- Date: 2025-09-03
-- Purpose: Ensure sequential numbering is unique per user across all projects for test_cases.

BEGIN;

-- 1) Backfill sequence per user deterministically by created_at
UPDATE public.test_cases c
SET sequence = s.seq
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY created_at ASC
         ) AS seq
  FROM public.test_cases
) AS s
WHERE c.id = s.id;

-- 2) Replace unique index: from (user_id, project_id, sequence) -> (user_id, sequence)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_test_cases_user_project_sequence'
  ) THEN
    EXECUTE 'DROP INDEX public.ux_test_cases_user_project_sequence';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_test_cases_user_sequence
  ON public.test_cases(user_id, sequence)
  WHERE sequence IS NOT NULL;

-- 3) Update trigger function to assign sequence globally per user with transactional lock
DROP FUNCTION IF EXISTS public.set_test_cases_project_and_sequence() CASCADE;
CREATE OR REPLACE FUNCTION public.set_test_cases_project_and_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure project_id mirrors the plan's project_id when missing
  IF NEW.project_id IS NULL THEN
    SELECT project_id INTO NEW.project_id
      FROM public.test_plans
     WHERE id = NEW.plan_id;
  END IF;

  -- Assign next sequence within the same user across all projects
  IF NEW.sequence IS NULL THEN
    -- Lock per user to avoid race conditions in concurrent inserts
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text), 0);

    SELECT COALESCE(MAX(sequence), 0) + 1
      INTO NEW.sequence
      FROM public.test_cases
     WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_test_cases_sequence ON public.test_cases;
CREATE TRIGGER trg_set_test_cases_sequence
BEFORE INSERT ON public.test_cases
FOR EACH ROW
EXECUTE FUNCTION public.set_test_cases_project_and_sequence();

-- 4) Utility to recompute sequences globally per user on demand
CREATE OR REPLACE FUNCTION public.recompute_test_cases_sequence_global(_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE public.test_cases c
     SET sequence = s.seq
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS seq
        FROM public.test_cases
       WHERE _user_id IS NULL OR user_id = _user_id
    ) s
   WHERE c.id = s.id;
END;
$$ LANGUAGE plpgsql;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
