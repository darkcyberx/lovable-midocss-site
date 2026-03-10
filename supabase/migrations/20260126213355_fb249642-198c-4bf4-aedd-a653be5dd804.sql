-- Fix: Add explicit policies to deny anonymous access

-- Profiles table - ensure only authenticated users can access
CREATE POLICY "Only authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop and recreate with proper restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Licenses table - add authenticated-only baseline
CREATE POLICY "Deny anonymous access to licenses"
ON public.licenses
FOR SELECT
TO anon
USING (false);

-- Logs table - add authenticated-only baseline  
CREATE POLICY "Deny anonymous access to logs"
ON public.logs
FOR SELECT
TO anon
USING (false);