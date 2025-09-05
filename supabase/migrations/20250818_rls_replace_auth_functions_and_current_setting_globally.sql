-- 20250818_rls_replace_auth_functions_and_current_setting_globally
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
        qual ILIKE '%auth.%()%' OR with_check ILIKE '%auth.%()%' OR
        qual ILIKE '%current_setting(%' OR with_check ILIKE '%current_setting(%'
      )
  LOOP
    new_using := r.qual;
    new_check := r.with_check;

    IF new_using IS NOT NULL THEN
      -- Wrap any auth.<fn>() with (select auth.<fn>())
      new_using := regexp_replace(new_using, '\bauth\.([a-zA-Z_]+)\(\)', '(select auth.\1())', 'g');
      -- Wrap current_setting(...) with (select current_setting(...))
      new_using := regexp_replace(new_using, '\bcurrent_setting\(', '(select current_setting(', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '\bauth\.([a-zA-Z_]+)\(\)', '(select auth.\1())', 'g');
      new_check := regexp_replace(new_check, '\bcurrent_setting\(', '(select current_setting(', 'g');
    END IF;

    using_clause := CASE WHEN new_using IS NOT NULL THEN format(' USING (%s)', new_using) ELSE '' END;
    check_clause := CASE WHEN new_check IS NOT NULL THEN format(' WITH CHECK (%s)', new_check) ELSE '' END;

    EXECUTE format('ALTER POLICY %I ON %I.%I%s%s', r.policyname, r.schemaname, r.tablename, using_clause, check_clause);
  END LOOP;
END $$;
