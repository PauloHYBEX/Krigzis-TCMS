-- Add sequential numbering to test tables: test_plans, test_cases, test_executions
-- Scope: per user_id to ensure numbering is stable and unique for each usuário

-- =====================
-- test_plans
-- =====================
ALTER TABLE IF EXISTS public.test_plans
  ADD COLUMN IF NOT EXISTS sequence INTEGER;

-- Populate existing rows with a stable sequence per user based on created_at
UPDATE public.test_plans p
SET sequence = sub.seq
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS seq
  FROM public.test_plans
) AS sub
WHERE p.id = sub.id AND p.sequence IS NULL;

-- Ensure uniqueness per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_test_plans_user_sequence
  ON public.test_plans(user_id, sequence)
  WHERE sequence IS NOT NULL;

-- Trigger function to auto-assign next sequence on insert
DROP FUNCTION IF EXISTS public.set_test_plans_sequence() CASCADE;
CREATE FUNCTION public.set_test_plans_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence IS NULL THEN
    SELECT COALESCE(MAX(sequence), 0) + 1 INTO NEW.sequence
    FROM public.test_plans
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_test_plans_sequence ON public.test_plans;
CREATE TRIGGER trg_set_test_plans_sequence
BEFORE INSERT ON public.test_plans
FOR EACH ROW
EXECUTE FUNCTION public.set_test_plans_sequence();


-- =====================
-- test_cases
-- =====================
ALTER TABLE IF EXISTS public.test_cases
  ADD COLUMN IF NOT EXISTS sequence INTEGER;

-- Populate existing rows with a stable sequence per user based on created_at
UPDATE public.test_cases c
SET sequence = sub.seq
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC) AS seq
  FROM public.test_cases
) AS sub
WHERE c.id = sub.id AND c.sequence IS NULL;

-- Ensure uniqueness per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_test_cases_user_sequence
  ON public.test_cases(user_id, sequence)
  WHERE sequence IS NOT NULL;

-- Trigger function to auto-assign next sequence on insert
DROP FUNCTION IF EXISTS public.set_test_cases_sequence() CASCADE;
CREATE FUNCTION public.set_test_cases_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence IS NULL THEN
    SELECT COALESCE(MAX(sequence), 0) + 1 INTO NEW.sequence
    FROM public.test_cases
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_test_cases_sequence ON public.test_cases;
CREATE TRIGGER trg_set_test_cases_sequence
BEFORE INSERT ON public.test_cases
FOR EACH ROW
EXECUTE FUNCTION public.set_test_cases_sequence();


-- =====================
-- test_executions
-- =====================
ALTER TABLE IF EXISTS public.test_executions
  ADD COLUMN IF NOT EXISTS sequence INTEGER;

-- Populate existing rows with a stable sequence per user based on executed_at (or created_at if null)
UPDATE public.test_executions e
SET sequence = sub.seq
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY COALESCE(executed_at, NOW()) ASC
         ) AS seq
  FROM public.test_executions
) AS sub
WHERE e.id = sub.id AND e.sequence IS NULL;

-- Ensure uniqueness per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_test_executions_user_sequence
  ON public.test_executions(user_id, sequence)
  WHERE sequence IS NOT NULL;

-- Trigger function to auto-assign next sequence on insert
DROP FUNCTION IF EXISTS public.set_test_executions_sequence() CASCADE;
CREATE FUNCTION public.set_test_executions_sequence()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sequence IS NULL THEN
    SELECT COALESCE(MAX(sequence), 0) + 1 INTO NEW.sequence
    FROM public.test_executions
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_set_test_executions_sequence ON public.test_executions;
CREATE TRIGGER trg_set_test_executions_sequence
BEFORE INSERT ON public.test_executions
FOR EACH ROW
EXECUTE FUNCTION public.set_test_executions_sequence();
