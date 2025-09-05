-- Create roles enum type
CREATE TYPE user_role AS ENUM ('master', 'admin', 'manager', 'tester');

-- Add role column to profiles table
ALTER TABLE IF EXISTS profiles 
ADD COLUMN role user_role NOT NULL DEFAULT 'tester';

-- Create user_permissions table for granular permissions
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_manage_users BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_plans BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_cases BOOLEAN NOT NULL DEFAULT TRUE,
  can_manage_executions BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_reports BOOLEAN NOT NULL DEFAULT TRUE,
  can_use_ai BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies for user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policy for selecting - only user themselves or masters/admins can view permissions
CREATE POLICY "Users can view their own permissions" 
  ON user_permissions 
  FOR SELECT 
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

-- Policy for inserting - only masters/admins can insert permissions
CREATE POLICY "Only masters and admins can insert permissions" 
  ON user_permissions 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

-- Policy for updating - only masters/admins can update permissions
CREATE POLICY "Only masters and admins can update permissions" 
  ON user_permissions 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

-- Set paulo.santos@hybex.com as master
UPDATE profiles 
SET role = 'master' 
WHERE email = 'paulo.santos@hybex.com';

-- Create trigger for updating the updated_at column
CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON user_permissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert default permissions for all existing users
INSERT INTO user_permissions (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Add master permissions for paulo.santos@hybex.com
UPDATE user_permissions 
SET can_manage_users = TRUE
FROM auth.users
WHERE auth.users.email = 'paulo.santos@hybex.com'
AND user_permissions.user_id = auth.users.id;

-- Update user_settings RLS policies to allow masters/admins to manage all settings
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
CREATE POLICY "Users can view settings" 
  ON user_settings 
  FOR SELECT 
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
CREATE POLICY "Users can insert settings" 
  ON user_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
CREATE POLICY "Users can update settings" 
  ON user_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

DROP POLICY IF EXISTS "Users can delete their own settings" ON user_settings;
CREATE POLICY "Users can delete settings" 
  ON user_settings 
  FOR DELETE 
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'master' OR profiles.role = 'admin')
  ));

-- Comments for documentation
COMMENT ON TABLE user_permissions IS 'Stores granular user permissions for system functionality';
COMMENT ON COLUMN user_permissions.can_manage_users IS 'User can create, edit, and manage other users';
COMMENT ON COLUMN user_permissions.can_manage_plans IS 'User can create, edit, and manage test plans';
COMMENT ON COLUMN user_permissions.can_manage_cases IS 'User can create, edit, and manage test cases';
COMMENT ON COLUMN user_permissions.can_manage_executions IS 'User can create, edit, and manage test executions';
COMMENT ON COLUMN user_permissions.can_view_reports IS 'User can view and export reports';
COMMENT ON COLUMN user_permissions.can_use_ai IS 'User can use AI-generation features'; 