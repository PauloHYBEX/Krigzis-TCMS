-- Safe cleanup script for testing data
-- Supports scopes: 'project', 'user', 'all'
-- Fill the variables below before running in the Supabase SQL editor.

DO $$
DECLARE
  v_scope TEXT := 'project';        -- 'project' | 'user' | 'all'
  v_project_id UUID := NULL;        -- required when v_scope = 'project'
  v_user_id UUID := NULL;           -- required when v_scope = 'user'; optional to further restrict 'project'
BEGIN
  IF v_scope NOT IN ('project','user','all') THEN
    RAISE EXCEPTION 'Invalid scope: % (expected: project|user|all)', v_scope;
  END IF;

  -- Defer FK checks within the transaction to allow ordered deletes
  SET CONSTRAINTS ALL DEFERRED;

  IF v_scope = 'project' THEN
    IF v_project_id IS NULL THEN
      RAISE EXCEPTION 'v_project_id is required when v_scope = project';
    END IF;

    -- 1) Defects linked to executions of the project's plans/cases
    WITH plans AS (
      SELECT id FROM public.test_plans p
      WHERE p.project_id = v_project_id
        AND (v_user_id IS NULL OR p.user_id = v_user_id)
    ), cases AS (
      SELECT c.id FROM public.test_cases c
      WHERE c.plan_id IN (SELECT id FROM plans)
        AND (v_user_id IS NULL OR c.user_id = v_user_id)
    ), execs AS (
      SELECT e.id FROM public.test_executions e
      WHERE (e.plan_id IN (SELECT id FROM plans) OR e.case_id IN (SELECT id FROM cases))
        AND (v_user_id IS NULL OR e.user_id = v_user_id)
    )
    DELETE FROM public.defects d
    WHERE d.execution_id IN (SELECT id FROM execs)
      AND (v_user_id IS NULL OR d.user_id = v_user_id);

    -- 2) Defects linked directly to cases
    WITH plans AS (
      SELECT id FROM public.test_plans p
      WHERE p.project_id = v_project_id
        AND (v_user_id IS NULL OR p.user_id = v_user_id)
    ), cases AS (
      SELECT c.id FROM public.test_cases c
      WHERE c.plan_id IN (SELECT id FROM plans)
        AND (v_user_id IS NULL OR c.user_id = v_user_id)
    )
    DELETE FROM public.defects d
    WHERE d.case_id IN (SELECT id FROM cases)
      AND (v_user_id IS NULL OR d.user_id = v_user_id);

    -- 3) Requirement links to cases (requirements themselves are user-scoped and global)
    WITH plans AS (
      SELECT id FROM public.test_plans p
      WHERE p.project_id = v_project_id
        AND (v_user_id IS NULL OR p.user_id = v_user_id)
    ), cases AS (
      SELECT c.id FROM public.test_cases c
      WHERE c.plan_id IN (SELECT id FROM plans)
        AND (v_user_id IS NULL OR c.user_id = v_user_id)
    )
    DELETE FROM public.requirements_cases rc
    WHERE rc.case_id IN (SELECT id FROM cases)
      AND (v_user_id IS NULL OR rc.user_id = v_user_id);

    -- 4) Executions
    WITH plans AS (
      SELECT id FROM public.test_plans p
      WHERE p.project_id = v_project_id
        AND (v_user_id IS NULL OR p.user_id = v_user_id)
    ), cases AS (
      SELECT c.id FROM public.test_cases c
      WHERE c.plan_id IN (SELECT id FROM plans)
        AND (v_user_id IS NULL OR c.user_id = v_user_id)
    )
    DELETE FROM public.test_executions e
    WHERE (e.plan_id IN (SELECT id FROM plans) OR e.case_id IN (SELECT id FROM cases))
      AND (v_user_id IS NULL OR e.user_id = v_user_id);

    -- 5) Cases
    WITH plans AS (
      SELECT id FROM public.test_plans p
      WHERE p.project_id = v_project_id
        AND (v_user_id IS NULL OR p.user_id = v_user_id)
    )
    DELETE FROM public.test_cases c
    WHERE c.plan_id IN (SELECT id FROM plans)
      AND (v_user_id IS NULL OR c.user_id = v_user_id);

    -- 6) Plans
    DELETE FROM public.test_plans p
    WHERE p.project_id = v_project_id
      AND (v_user_id IS NULL OR p.user_id = v_user_id);

  ELSIF v_scope = 'user' THEN
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'v_user_id is required when v_scope = user';
    END IF;

    -- Order: defects -> requirement links -> requirements -> executions -> cases -> plans
    DELETE FROM public.defects d WHERE d.user_id = v_user_id;
    DELETE FROM public.requirements_cases rc WHERE rc.user_id = v_user_id;
    DELETE FROM public.requirements r WHERE r.user_id = v_user_id;
    DELETE FROM public.test_executions e WHERE e.user_id = v_user_id;
    DELETE FROM public.test_cases c WHERE c.user_id = v_user_id;
    DELETE FROM public.test_plans p WHERE p.user_id = v_user_id;

  ELSE -- v_scope = 'all'
    -- Be careful: this wipes ALL testing data across all users and projects
    -- Order chosen to avoid FK violations and minimize SET NULL effects
    DELETE FROM public.defects;
    DELETE FROM public.requirements_cases;
    DELETE FROM public.requirements;
    DELETE FROM public.test_executions;
    DELETE FROM public.test_cases;
    DELETE FROM public.test_plans;
  END IF;

  RAISE NOTICE 'Cleanup completed for scope=% with project_id=% and user_id=%', v_scope, v_project_id, v_user_id;
END $$;
