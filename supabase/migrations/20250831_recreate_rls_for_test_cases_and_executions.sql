-- Migration: Recreate RLS for test_cases and test_executions (ownership by user_id)
-- Date: 2025-08-31
-- Purpose: Fix 403 Forbidden on inserts/selects after policies were removed during org_id cleanup.

BEGIN;

-- =====================
-- test_cases
-- =====================
-- Ensure RLS is enabled
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can view their own test_cases" ON public.test_cases;
DROP POLICY IF EXISTS "Users can create their own test_cases" ON public.test_cases;
DROP POLICY IF EXISTS "Users can update their own test_cases" ON public.test_cases;
DROP POLICY IF EXISTS "Users can delete their own test_cases" ON public.test_cases;

-- Recreate ownership policies by user_id
CREATE POLICY "Users can view their own test_cases" ON public.test_cases
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create their own test_cases" ON public.test_cases
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own test_cases" ON public.test_cases
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own test_cases" ON public.test_cases
  FOR DELETE USING (user_id = (select auth.uid()));

-- Ensure required column exists before FK/indexes
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS user_id UUID;

-- Ensure FK for user_id exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_test_cases_user_id'
      AND table_schema = 'public' AND table_name = 'test_cases'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_cases
             ADD CONSTRAINT fk_test_cases_user_id
             FOREIGN KEY (user_id)
             REFERENCES auth.users(id)
             ON DELETE CASCADE';
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_test_cases_user_id ON public.test_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_plan_id ON public.test_cases(plan_id);

-- Trigger to maintain updated_at (safe to re-create)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS update_test_cases_updated_at ON public.test_cases;
CREATE TRIGGER update_test_cases_updated_at
  BEFORE UPDATE ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- test_executions
-- =====================
ALTER TABLE public.test_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own test_executions" ON public.test_executions;
DROP POLICY IF EXISTS "Users can create their own test_executions" ON public.test_executions;
DROP POLICY IF EXISTS "Users can update their own test_executions" ON public.test_executions;
DROP POLICY IF EXISTS "Users can delete their own test_executions" ON public.test_executions;

CREATE POLICY "Users can view their own test_executions" ON public.test_executions
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "Users can create their own test_executions" ON public.test_executions
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own test_executions" ON public.test_executions
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own test_executions" ON public.test_executions
  FOR DELETE USING (user_id = (select auth.uid()));

-- Ensure required column exists before FK/indexes
ALTER TABLE public.test_executions ADD COLUMN IF NOT EXISTS user_id UUID;

-- Ensure FK for user_id exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_test_executions_user_id'
      AND table_schema = 'public' AND table_name = 'test_executions'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_executions
             ADD CONSTRAINT fk_test_executions_user_id
             FOREIGN KEY (user_id)
             REFERENCES auth.users(id)
             ON DELETE CASCADE';
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_test_executions_user_id ON public.test_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id ON public.test_executions(case_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_plan_id ON public.test_executions(plan_id);

-- No updated_at on executions; executed_at is managed by app. Skip trigger.

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
