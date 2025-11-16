-- Add vehicle_year column to profiles table for driver information
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS vehicle_year text;