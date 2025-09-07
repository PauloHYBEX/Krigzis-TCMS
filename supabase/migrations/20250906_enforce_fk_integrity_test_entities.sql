-- Enforce FK integrity between plans, cases and executions
-- Date: 2025-09-06
-- This migration makes deletions safe by preventing removal of parent rows when children exist
-- and by ensuring executions/cases always reference valid parents.

BEGIN;

-- 1) Cleanup potential orphaned rows to avoid FK creation failures
--    a) Executions pointing to non-existing plans/cases
DELETE FROM public.test_executions e
WHERE e.plan_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.test_plans p WHERE p.id = e.plan_id
);

DELETE FROM public.test_executions e
WHERE e.case_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.test_cases c WHERE c.id = e.case_id
);

--    b) Cases pointing to non-existing plans -> set to NULL (cases may be detached from a plan)
UPDATE public.test_cases tc
SET plan_id = NULL
WHERE tc.plan_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.test_plans p WHERE p.id = tc.plan_id
);

-- 2) Create missing indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_test_cases_plan_id ON public.test_cases(plan_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_plan_id ON public.test_executions(plan_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id ON public.test_executions(case_id);

-- 3) Add Foreign Key constraints with ON DELETE RESTRICT (idempotent)
--    Postgres does not support IF NOT EXISTS for FK, so wrap checks in DO blocks

-- test_cases.plan_id -> test_plans.id (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'fk_test_cases_plan_id'
  ) THEN
    ALTER TABLE public.test_cases
      ADD CONSTRAINT fk_test_cases_plan_id
      FOREIGN KEY (plan_id)
      REFERENCES public.test_plans(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- test_executions.plan_id -> test_plans.id (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'fk_test_executions_plan_id'
  ) THEN
    ALTER TABLE public.test_executions
      ADD CONSTRAINT fk_test_executions_plan_id
      FOREIGN KEY (plan_id)
      REFERENCES public.test_plans(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- test_executions.case_id -> test_cases.id (RESTRICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'fk_test_executions_case_id'
  ) THEN
    ALTER TABLE public.test_executions
      ADD CONSTRAINT fk_test_executions_case_id
      FOREIGN KEY (case_id)
      REFERENCES public.test_cases(id)
      ON DELETE RESTRICT
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

-- 4) Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
