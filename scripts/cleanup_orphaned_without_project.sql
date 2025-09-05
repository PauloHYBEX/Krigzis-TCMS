-- Cleanup orphaned testing data without project assignments
-- This script removes data related to test plans that have project_id IS NULL
-- and any dependent cases, executions, defects, and requirement links.
-- Optional: restrict by user_id to avoid affecting other users' data.

DO $$
DECLARE
  v_user_id UUID := NULL; -- set to a user id to restrict cleanup, or keep NULL for all users
BEGIN
  -- Defer FK checks to allow ordered deletes within the transaction
  SET CONSTRAINTS ALL DEFERRED;

  -- Identify orphan plans/cases/executions using temporary tables
  CREATE TEMP TABLE t_orphan_plans (id uuid) ON COMMIT DROP;
  INSERT INTO t_orphan_plans (id)
  SELECT p.id
  FROM public.test_plans p
  WHERE p.project_id IS NULL
    AND (v_user_id IS NULL OR p.user_id = v_user_id);

  CREATE TEMP TABLE t_orphan_cases (id uuid) ON COMMIT DROP;
  INSERT INTO t_orphan_cases (id)
  SELECT c.id
  FROM public.test_cases c
  WHERE c.plan_id IN (SELECT id FROM t_orphan_plans)
    AND (v_user_id IS NULL OR c.user_id = v_user_id);

  CREATE TEMP TABLE t_orphan_execs (id uuid) ON COMMIT DROP;
  INSERT INTO t_orphan_execs (id)
  SELECT e.id
  FROM public.test_executions e
  WHERE (e.plan_id IN (SELECT id FROM t_orphan_plans)
     OR e.case_id IN (SELECT id FROM t_orphan_cases))
    AND (v_user_id IS NULL OR e.user_id = v_user_id);

  -- 1) Defects linked to executions of orphan plans/cases
  DELETE FROM public.defects d
  WHERE d.execution_id IN (SELECT id FROM t_orphan_execs)
    AND (v_user_id IS NULL OR d.user_id = v_user_id);

  -- 2) Defects linked directly to orphan cases
  DELETE FROM public.defects d
  WHERE d.case_id IN (SELECT id FROM t_orphan_cases)
    AND (v_user_id IS NULL OR d.user_id = v_user_id);

  -- 3) Requirement links to orphan cases
  DELETE FROM public.requirements_cases rc
  WHERE rc.case_id IN (SELECT id FROM t_orphan_cases)
    AND (v_user_id IS NULL OR rc.user_id = v_user_id);

  -- 4) Executions related to orphan plans/cases
  DELETE FROM public.test_executions e
  WHERE (e.plan_id IN (SELECT id FROM t_orphan_plans)
     OR e.case_id IN (SELECT id FROM t_orphan_cases))
    AND (v_user_id IS NULL OR e.user_id = v_user_id);

  -- 5) Cases under orphan plans
  DELETE FROM public.test_cases c
  WHERE c.plan_id IN (SELECT id FROM t_orphan_plans)
    AND (v_user_id IS NULL OR c.user_id = v_user_id);

  -- 6) Finally, orphan plans
  DELETE FROM public.test_plans p
  WHERE p.project_id IS NULL
    AND (v_user_id IS NULL OR p.user_id = v_user_id);

  -- Additionally, handle cases that have no plan_id at all (defensive cleanup)
  CREATE TEMP TABLE t_cases_no_plan (id uuid) ON COMMIT DROP;
  INSERT INTO t_cases_no_plan (id)
  SELECT c.id
  FROM public.test_cases c
  WHERE c.plan_id IS NULL
    AND (v_user_id IS NULL OR c.user_id = v_user_id);

  CREATE TEMP TABLE t_execs_no_plan (id uuid) ON COMMIT DROP;
  INSERT INTO t_execs_no_plan (id)
  SELECT e.id
  FROM public.test_executions e
  WHERE e.case_id IN (SELECT id FROM t_cases_no_plan)
    AND (v_user_id IS NULL OR e.user_id = v_user_id);

  -- Defects linked to executions of cases with no plan
  DELETE FROM public.defects d
  WHERE d.execution_id IN (SELECT id FROM t_execs_no_plan)
    AND (v_user_id IS NULL OR d.user_id = v_user_id);

  -- Defects linked directly to cases with no plan
  DELETE FROM public.defects d
  WHERE d.case_id IN (SELECT id FROM t_cases_no_plan)
    AND (v_user_id IS NULL OR d.user_id = v_user_id);

  -- Requirement links for cases with no plan
  DELETE FROM public.requirements_cases rc
  WHERE rc.case_id IN (SELECT id FROM t_cases_no_plan)
    AND (v_user_id IS NULL OR rc.user_id = v_user_id);

  -- Executions for cases with no plan
  DELETE FROM public.test_executions e
  WHERE e.case_id IN (SELECT id FROM t_cases_no_plan)
    AND (v_user_id IS NULL OR e.user_id = v_user_id);

  -- Finally, delete cases with no plan
  DELETE FROM public.test_cases c
  WHERE c.plan_id IS NULL
    AND (v_user_id IS NULL OR c.user_id = v_user_id);

  RAISE NOTICE 'Cleanup completed for orphan entities (project_id IS NULL). user_id=%', v_user_id;
END $$;
