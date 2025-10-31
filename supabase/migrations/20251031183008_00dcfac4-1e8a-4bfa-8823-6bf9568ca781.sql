-- Add application-related fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS applied_role text CHECK (applied_role IN ('farmer','lead_farmer')),
  ADD COLUMN IF NOT EXISTS farm_size text,
  ADD COLUMN IF NOT EXISTS produce_types text,
  ADD COLUMN IF NOT EXISTS additional_info text;

-- Allow admins to manage farm profiles so they can create them upon approval
CREATE POLICY "Admins can manage farm profiles"
ON public.farm_profiles
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));