-- Create trigger for auto-approving consumers
CREATE TRIGGER on_consumer_role_added
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_consumer();

-- Update the existing user's approval status to approved
UPDATE public.profiles
SET 
  approval_status = 'approved',
  approved_at = now()
WHERE id = '86880911-f676-4967-bb86-72658961a45b'
  AND approval_status = 'pending';