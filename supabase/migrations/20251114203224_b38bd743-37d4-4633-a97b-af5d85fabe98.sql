-- Create company_settings table for payer information
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read and write
CREATE POLICY "Admins can manage company settings"
  ON company_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Authenticated users can read (needed for 1099 generation)
CREATE POLICY "Authenticated users can read company settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION moddatetime (updated_at);

-- Insert default company settings (can be updated by admin later)
INSERT INTO company_settings (legal_name, tax_id)
VALUES ('Blue Harvests Inc.', 'XX-XXXXXXX')
ON CONFLICT DO NOTHING;
