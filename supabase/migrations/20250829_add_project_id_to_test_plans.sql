-- Migration: Add project_id to test_plans
-- Date: 2025-08-29
-- Purpose: Align backend schema with frontend expectations. Frontend sends project_id on insert/select.

BEGIN;

-- 1) Ensure column exists (nullable for now to avoid backfill issues)
ALTER TABLE IF EXISTS public.test_plans
  ADD COLUMN IF NOT EXISTS project_id UUID;

-- 2) Ensure referenced table exists (optional safety, won't error if it already exists)
-- NOTE: If you already created projects via scripts/create_projects_table.sql, this is a no-op.
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  color VARCHAR(7) DEFAULT '#3b82f6',
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3) Add FK constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_test_plans_project_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.test_plans
             ADD CONSTRAINT fk_test_plans_project_id
             FOREIGN KEY (project_id)
             REFERENCES public.projects(id)
             ON DELETE CASCADE';
  END IF;
END $$;

-- 4) Index for filtering by project
CREATE INDEX IF NOT EXISTS idx_test_plans_project_id
  ON public.test_plans(project_id);

-- 5) RLS for projects table (idempotent)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects" ON public.projects
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" ON public.projects
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects" ON public.projects
  FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects" ON public.projects
  FOR DELETE USING (user_id = auth.uid());

-- NOTE:
-- We keep test_plans.project_id NULLABLE for now. Frontend inserts it; existing rows remain NULL.
-- After backfilling, you may enforce NOT NULL:
--   ALTER TABLE public.test_plans ALTER COLUMN project_id SET NOT NULL;

COMMIT;
