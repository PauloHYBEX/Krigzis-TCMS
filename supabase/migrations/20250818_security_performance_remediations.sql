-- 20250818_security_performance_remediations
-- Security: set search_path on flagged functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_test_plans_sequence',
        'set_test_cases_sequence',
        'set_test_executions_sequence',
        'set_updated_at',
        'generate_database_id',
        'handle_new_user',
        'update_updated_at_column',
        'associate_user_to_organization',
        'create_default_organization'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.signature);
  END LOOP;
END $$;

-- Performance: use (select auth.uid()) in RLS policies for newly created tables
-- notifications
DROP POLICY IF EXISTS "notifications_select_owner_or_admin" ON public.notifications;
CREATE POLICY "notifications_select_owner_or_admin" ON public.notifications
FOR SELECT
USING (
  (select auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "notifications_insert_owner_or_admin" ON public.notifications;
CREATE POLICY "notifications_insert_owner_or_admin" ON public.notifications
FOR INSERT
WITH CHECK (
  (select auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "notifications_update_owner_or_admin" ON public.notifications;
CREATE POLICY "notifications_update_owner_or_admin" ON public.notifications
FOR UPDATE
USING (
  (select auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "notifications_delete_admin" ON public.notifications;
CREATE POLICY "notifications_delete_admin" ON public.notifications
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- notification_preferences
DROP POLICY IF EXISTS "notif_prefs_select_owner_or_admin" ON public.notification_preferences;
CREATE POLICY "notif_prefs_select_owner_or_admin" ON public.notification_preferences
FOR SELECT
USING (
  (select auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "notif_prefs_upsert_owner" ON public.notification_preferences;
CREATE POLICY "notif_prefs_upsert_owner" ON public.notification_preferences
FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "notif_prefs_update_owner" ON public.notification_preferences;
CREATE POLICY "notif_prefs_update_owner" ON public.notification_preferences
FOR UPDATE
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "notif_prefs_delete_owner" ON public.notification_preferences;
CREATE POLICY "notif_prefs_delete_owner" ON public.notification_preferences
FOR DELETE
USING ((select auth.uid()) = user_id);

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_select_owner_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_select_owner_or_admin" ON public.activity_logs
FOR SELECT
USING (
  (select auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "activity_logs_insert_owner_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_owner_or_admin" ON public.activity_logs
FOR INSERT
WITH CHECK (
  (select auth.uid()) = user_id OR EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = (select auth.uid()) AND (p.role = 'master' OR p.role = 'admin')
  )
);

-- Performance: covering indexes for reported foreign keys
CREATE INDEX IF NOT EXISTS idx_organization_members_invited_by ON public.organization_members (invited_by);
CREATE INDEX IF NOT EXISTS idx_test_cases_plan_id ON public.test_cases (plan_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_case_id ON public.test_executions (case_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_plan_id ON public.test_executions (plan_id);
