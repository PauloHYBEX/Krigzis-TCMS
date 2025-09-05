-- Migration: Sequence per project for test_plans and test_cases
-- Date: 2025-09-01
-- Purpose: Ensure sequential numbering is unique per (user_id, project_id) for plans and cases.

BEGIN;

-- =====================
-- test_plans: sequence per (user_id, project_id)
-- =====================
-- Backfill sequence per project deterministically by created_at
UPDATE public.test_plans p
SET sequence = sub.seq
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, project_id
           ORDER BY created_at ASC
         ) AS seq
  FROM public.test_plans
) AS sub
WHERE p.id = sub.id;

-- Replace unique index: from (user_id, sequence) -> (user_id, project_id, sequence)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_test_plans_user_sequence'
  ) THEN
    EXECUTE 'DROP INDEX public.ux_test_plans_user_sequence';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_test_plans_user_project_sequence
  ON public.test_plans(user_id, project_id, sequence)
  WHERE sequence IS NOT NULL AND project_id IS NOT NULL;

-- Update trigger function to assign sequence per project
DROP FUNCTION IF EXISTS public.set_test_plans_sequence() CASCADE;
CREATE FUNCTION public.set_test_plans_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence IS NULL THEN
    IF NEW.project_id IS NULL THEN
      SELECT COALESCE(MAX(sequence), 0) + 1
        INTO NEW.sequence
        FROM public.test_plans
       WHERE user_id = NEW.user_id
         AND project_id IS NULL;
    ELSE
      SELECT COALESCE(MAX(sequence), 0) + 1
        INTO NEW.sequence
        FROM public.test_plans
       WHERE user_id = NEW.user_id
         AND project_id = NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_test_plans_sequence ON public.test_plans;
CREATE TRIGGER trg_set_test_plans_sequence
BEFORE INSERT ON public.test_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_test_plans_sequence();


-- =====================
-- test_cases: add project_id, sequence per (user_id, project_id)
-- =====================
ALTER TABLE IF EXISTS public.test_cases
  ADD COLUMN IF NOT EXISTS project_id UUID;

-- Backfill project_id from test_plans
UPDATE public.test_cases c
SET project_id = p.project_id
FROM public.test_plans p
WHERE c.plan_id = p.id
  AND c.project_id IS NULL;

-- Add FK for project_id (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_test_cases_project_id'
      AND table_schema = 'public' AND table_name = 'test_cases'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_cases
             ADD CONSTRAINT fk_test_cases_project_id
             FOREIGN KEY (project_id)
             REFERENCES public.projects(id)
             ON DELETE CASCADE';
  END IF;
END $$;

-- Helpful index for filtering by project
CREATE INDEX IF NOT EXISTS idx_test_cases_project_id ON public.test_cases(project_id);

-- Recompute sequence per (user_id, project_id)
UPDATE public.test_cases c
SET sequence = sub.seq
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, project_id
           ORDER BY created_at ASC
         ) AS seq
  FROM public.test_cases
) AS sub
WHERE c.id = sub.id;

-- Replace unique index: from (user_id, sequence) -> (user_id, project_id, sequence)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'ux_test_cases_user_sequence'
  ) THEN
    EXECUTE 'DROP INDEX public.ux_test_cases_user_sequence';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_test_cases_user_project_sequence
  ON public.test_cases(user_id, project_id, sequence)
  WHERE sequence IS NOT NULL AND project_id IS NOT NULL;

-- Trigger function: ensure project_id from plan_id, then set sequence per project
DROP FUNCTION IF EXISTS public.set_test_cases_sequence() CASCADE;
DROP FUNCTION IF EXISTS public.set_test_cases_project_and_sequence() CASCADE;
CREATE OR REPLACE FUNCTION public.set_test_cases_project_and_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure project_id mirrors the plan's project_id
  IF NEW.project_id IS NULL THEN
    SELECT project_id INTO NEW.project_id
      FROM public.test_plans
     WHERE id = NEW.plan_id;
  END IF;

  -- Assign next sequence within (user_id, project_id)
  IF NEW.sequence IS NULL THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT COALESCE(MAX(sequence), 0) + 1
        INTO NEW.sequence
        FROM public.test_cases
       WHERE user_id = NEW.user_id
         AND project_id = NEW.project_id;
    ELSE
      -- Fallback to per-user if no project_id (legacy rows)
      SELECT COALESCE(MAX(sequence), 0) + 1
        INTO NEW.sequence
        FROM public.test_cases
       WHERE user_id = NEW.user_id
         AND project_id IS NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_test_cases_sequence ON public.test_cases;
CREATE TRIGGER trg_set_test_cases_sequence
BEFORE INSERT ON public.test_cases
FOR EACH ROW
EXECUTE FUNCTION public.set_test_cases_project_and_sequence();


-- =====================
-- Utility: recompute sequences per project on demand
-- =====================
CREATE OR REPLACE FUNCTION public.recompute_sequences_per_project(_user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  -- Plans
  UPDATE public.test_plans p
     SET sequence = s.seq
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id, project_id ORDER BY created_at ASC) AS seq
        FROM public.test_plans
       WHERE _user_id IS NULL OR user_id = _user_id
    ) s
   WHERE p.id = s.id;

  -- Cases
  UPDATE public.test_cases c
     SET sequence = s.seq
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY user_id, project_id ORDER BY created_at ASC) AS seq
        FROM public.test_cases
       WHERE _user_id IS NULL OR user_id = _user_id
    ) s
   WHERE c.id = s.id;
END;
$$ LANGUAGE plpgsql;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
