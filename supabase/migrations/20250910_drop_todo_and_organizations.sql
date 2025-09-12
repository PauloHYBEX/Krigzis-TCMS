-- Krigzis-TCMS: Drop legacy To-Do and Organizations (safe)
-- Date: 2025-09-10

-- 1) Drop To-Do system tables (if present)
DROP TABLE IF EXISTS public.todo_tasks CASCADE;
DROP TABLE IF EXISTS public.todo_folders CASCADE;

-- 2) Drop Organizations tables (if present)
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- 3) Remove legacy columns related to organizations from core tables
ALTER TABLE public.profiles DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.user_permissions DROP COLUMN IF EXISTS organization_id;

-- 4) Cleanup legacy policies or functions (no-op if not found)
-- Policies are removed with table drops; leave placeholders for clarity
-- DROP POLICY IF EXISTS "Members can view organization" ON public.organizations;
-- DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;

-- 5) Confirm core tables still exist (optional sanity check via comments)
-- profiles, user_permissions, test_plans, test_cases, test_executions

-- 6) Note: Regenerate TypeScript types after applying this migration
-- npx supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
