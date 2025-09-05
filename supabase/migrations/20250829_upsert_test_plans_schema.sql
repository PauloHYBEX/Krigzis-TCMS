-- Migration: Upsert test_plans schema to match frontend expectations
-- Date: 2025-08-29
-- This migration ensures required columns, indexes, RLS and triggers exist on public.test_plans.

BEGIN;

-- 1) Ensure table exists (won't create if it's already there). If it doesn't exist, create minimal structure.
CREATE TABLE IF NOT EXISTS public.test_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 2) Ensure required columns exist (idempotent)
ALTER TABLE IF EXISTS public.test_plans
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS scope TEXT,
  ADD COLUMN IF NOT EXISTS approach TEXT,
  ADD COLUMN IF NOT EXISTS criteria TEXT,
  ADD COLUMN IF NOT EXISTS resources TEXT,
  ADD COLUMN IF NOT EXISTS schedule TEXT,
  ADD COLUMN IF NOT EXISTS risks TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3) Ensure FK for user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_test_plans_user_id'
      AND table_schema = 'public' AND table_name = 'test_plans'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_plans
             ADD CONSTRAINT fk_test_plans_user_id
             FOREIGN KEY (user_id)
             REFERENCES auth.users(id)
             ON DELETE CASCADE';
  END IF;
END $$;

-- 4) Ensure index for user_id (query filters)
CREATE INDEX IF NOT EXISTS idx_test_plans_user_id ON public.test_plans(user_id);

-- 5) Ensure status index (optional but useful)
CREATE INDEX IF NOT EXISTS idx_test_plans_status ON public.test_plans(status);

-- Note: project_id column, FK and index are handled in 20250829_add_project_id_to_test_plans.sql

-- 6) RLS policies (idempotent)
ALTER TABLE public.test_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own test_plans" ON public.test_plans;
CREATE POLICY "Users can view their own test_plans" ON public.test_plans
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own test_plans" ON public.test_plans;
CREATE POLICY "Users can create their own test_plans" ON public.test_plans
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own test_plans" ON public.test_plans;
CREATE POLICY "Users can update their own test_plans" ON public.test_plans
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own test_plans" ON public.test_plans;
CREATE POLICY "Users can delete their own test_plans" ON public.test_plans
  FOR DELETE USING (user_id = auth.uid());

-- 7) Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_test_plans_updated_at ON public.test_plans;
CREATE TRIGGER update_test_plans_updated_at
  BEFORE UPDATE ON public.test_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Refresh PostgREST schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
