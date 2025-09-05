-- 20250818_rls_replace_auth_uid_globally_fix
DO $$
DECLARE 
  r record;
  new_using text;
  new_check text;
  using_clause text;
  check_clause text;
BEGIN
  FOR r IN 
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual ILIKE '%auth.uid()%' OR with_check ILIKE '%auth.uid()%'
      )
  LOOP
    new_using := r.qual;
    new_check := r.with_check;

    IF new_using IS NOT NULL THEN
      new_using := regexp_replace(new_using, '\bauth\.uid\(\)', '(select auth.uid())', 'gi');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '\bauth\.uid\(\)', '(select auth.uid())', 'gi');
    END IF;

    using_clause := CASE WHEN new_using IS NOT NULL THEN format(' USING (%s)', new_using) ELSE '' END;
    check_clause := CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

    EXECUTE format('ALTER POLICY %I ON %I.%I%s%s', r.policyname, r.schemaname, r.tablename, using_clause, check_clause);
  END LOOP;
END $$;
