-- Add validation function to prevent role mismatches
-- This ensures that roles in user_roles match the applied_role in profiles

CREATE OR REPLACE FUNCTION validate_role_assignment()
RETURNS TRIGGER AS $$
DECLARE
  user_applied_role TEXT;
BEGIN
  -- Get the user's applied_role from profiles
  SELECT applied_role INTO user_applied_role
  FROM profiles
  WHERE id = NEW.user_id;

  -- If applied_role is set and doesn't match, prevent the role assignment
  IF user_applied_role IS NOT NULL AND user_applied_role != NEW.role::text THEN
    -- Allow consumer role even if applied_role is different (auto-approved)
    IF NEW.role::text != 'consumer' THEN
      RAISE EXCEPTION 'Role mismatch: user applied for % but attempting to assign %', 
        user_applied_role, NEW.role::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to validate role assignments
DROP TRIGGER IF EXISTS validate_role_assignment_trigger ON user_roles;
CREATE TRIGGER validate_role_assignment_trigger
  BEFORE INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION validate_role_assignment();

-- Add comment for documentation
COMMENT ON FUNCTION validate_role_assignment() IS 
  'Validates that roles assigned in user_roles match the applied_role in profiles to prevent privilege escalation';

-- Add index to improve validation performance
CREATE INDEX IF NOT EXISTS idx_profiles_applied_role ON profiles(id, applied_role);