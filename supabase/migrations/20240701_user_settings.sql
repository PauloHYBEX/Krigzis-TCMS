-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

-- Add RLS policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Policy for selecting
CREATE POLICY "Users can view their own settings" 
  ON user_settings 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policy for inserting
CREATE POLICY "Users can insert their own settings" 
  ON user_settings 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy for updating
CREATE POLICY "Users can update their own settings" 
  ON user_settings 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy for deleting
CREATE POLICY "Users can delete their own settings" 
  ON user_settings 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create type definitions
COMMENT ON TABLE user_settings IS 'Stores user-specific settings and configurations';
COMMENT ON COLUMN user_settings.key IS 'Setting key identifier';
COMMENT ON COLUMN user_settings.value IS 'JSON value of the setting';

-- Create trigger for updating the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column(); 