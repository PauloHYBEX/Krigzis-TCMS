-- Migration: Drop To-Do system and legacy access_tokens/access_logs
-- Date: 2025-08-14
-- Purpose: Remove all DB objects related to the deprecated To-Do system and legacy tokens/logs,
--          and clean up user_permissions columns.

-- 1) Drop To-Do related tables (order matters due to FKs)
DROP TABLE IF EXISTS public.todo_activity_log CASCADE;
DROP TABLE IF EXISTS public.todo_comments CASCADE;
DROP TABLE IF EXISTS public.todo_attachments CASCADE;
DROP TABLE IF EXISTS public.todo_subtasks CASCADE;
DROP TABLE IF EXISTS public.todo_tasks CASCADE;
DROP TABLE IF EXISTS public.todo_folders CASCADE;
DROP TABLE IF EXISTS public.todo_templates CASCADE;
-- Some environments had this name
DROP TABLE IF EXISTS public.todo_items CASCADE;

-- 2) Drop legacy tokens/logs tables
DROP TABLE IF EXISTS public.access_logs CASCADE;
DROP TABLE IF EXISTS public.access_tokens CASCADE;

-- 3) Remove To-Do permission columns from user_permissions
ALTER TABLE IF EXISTS public.user_permissions
  DROP COLUMN IF EXISTS can_access_todo,
  DROP COLUMN IF EXISTS can_manage_todo_folders,
  DROP COLUMN IF EXISTS can_manage_todo_tasks,
  DROP COLUMN IF EXISTS can_manage_all_todos,
  DROP COLUMN IF EXISTS can_upload_attachments,
  DROP COLUMN IF EXISTS can_comment_tasks,
  DROP COLUMN IF EXISTS can_assign_tasks;

-- 4) Ensure UNIQUE (user_id, organization_id) is set for user_permissions
--    First, if there's a UNIQUE only on user_id, attempt to drop it safely.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'u'
    AND n.nspname = 'public'
    AND t.relname = 'user_permissions'
    AND (
      SELECT array_agg(att.attname ORDER BY att.attnum)
      FROM unnest(c.conkey) AS col(attnum)
      JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = col.attnum
    ) = ARRAY['user_id'];

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_permissions DROP CONSTRAINT %I', conname);
  END IF;
END$$;

-- Add UNIQUE (user_id, organization_id) if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'u'
      AND n.nspname = 'public'
      AND t.relname = 'user_permissions'
      AND (
        SELECT array_agg(att.attname ORDER BY att.attnum)
        FROM unnest(c.conkey) AS col(attnum)
        JOIN pg_attribute att ON att.attrelid = c.conrelid AND att.attnum = col.attnum
      ) = ARRAY['user_id','organization_id']
  ) THEN
    ALTER TABLE public.user_permissions
      ADD CONSTRAINT user_permissions_user_org_unique UNIQUE (user_id, organization_id);
  END IF;
END$$;
