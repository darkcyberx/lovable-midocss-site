-- Fix RLS policies for licenses table
DROP POLICY IF EXISTS "Authenticated users can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated users can insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated users can update licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated users can delete licenses" ON public.licenses;

CREATE POLICY "Admins can view licenses"
ON public.licenses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert licenses"
ON public.licenses
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update licenses"
ON public.licenses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete licenses"
ON public.licenses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS policies for devices table
DROP POLICY IF EXISTS "Authenticated users can view devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can insert devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can update devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can delete devices" ON public.devices;

CREATE POLICY "Admins can view devices"
ON public.devices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert devices"
ON public.devices
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow validate-license edge function to insert devices via service role
-- (Edge function uses service role key, not affected by these policies)

-- Remove legacy role column from profiles table to avoid confusion
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;