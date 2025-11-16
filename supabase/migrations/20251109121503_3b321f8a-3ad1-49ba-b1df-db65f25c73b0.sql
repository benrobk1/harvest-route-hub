-- Fix security warning by setting search_path on the validation function
CREATE OR REPLACE FUNCTION validate_role_assignment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;