-- Requirements, Requirements-Cases linking, and Defects (Phase 1)
-- Safe extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- requirements
-- =====================
CREATE TABLE IF NOT EXISTS public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','approved','deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requirements_user_id ON public.requirements(user_id);

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY requirements_select ON public.requirements
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY requirements_insert ON public.requirements
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY requirements_update ON public.requirements
    FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY requirements_delete ON public.requirements
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_requirements_set_updated_at ON public.requirements;
CREATE TRIGGER trg_requirements_set_updated_at
BEFORE UPDATE ON public.requirements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- requirements_cases (link table)
-- =====================
CREATE TABLE IF NOT EXISTS public.requirements_cases (
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (requirement_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_requirements_cases_user_id ON public.requirements_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_requirements_cases_case_id ON public.requirements_cases(case_id);
CREATE INDEX IF NOT EXISTS idx_requirements_cases_req_id ON public.requirements_cases(requirement_id);

ALTER TABLE public.requirements_cases ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY requirements_cases_select ON public.requirements_cases
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY requirements_cases_insert ON public.requirements_cases
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY requirements_cases_update ON public.requirements_cases
    FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY requirements_cases_delete ON public.requirements_cases
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================
-- defects
-- =====================
CREATE TABLE IF NOT EXISTS public.defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_analysis','fixed','validated','closed')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  case_id UUID NULL REFERENCES public.test_cases(id) ON DELETE SET NULL,
  execution_id UUID NULL REFERENCES public.test_executions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defects_user_id ON public.defects(user_id);
CREATE INDEX IF NOT EXISTS idx_defects_case_id ON public.defects(case_id);
CREATE INDEX IF NOT EXISTS idx_defects_execution_id ON public.defects(execution_id);

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY defects_select ON public.defects
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY defects_insert ON public.defects
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY defects_update ON public.defects
    FOR UPDATE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY defects_delete ON public.defects
    FOR DELETE USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_defects_set_updated_at ON public.defects;
CREATE TRIGGER trg_defects_set_updated_at
BEFORE UPDATE ON public.defects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
