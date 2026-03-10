-- Fix 1: Make logs table append-only (prevent UPDATE and DELETE)
-- Create explicit deny policies for UPDATE and DELETE
CREATE POLICY "No one can update logs" 
ON public.logs 
FOR UPDATE 
TO authenticated
USING (false);

CREATE POLICY "No one can delete logs" 
ON public.logs 
FOR DELETE 
TO authenticated
USING (false);

-- Fix 2: Add additional protection for customers table
-- Ensure that customers can only be accessed through proper channels
-- Update RLS to use more restrictive patterns

-- Drop and recreate customer policies with stronger protection
DROP POLICY IF EXISTS "Customers can view their own data" ON public.customers;

-- Customers can ONLY view their own data (not other customers by guessing IDs)
CREATE POLICY "Customers can view their own data only" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Add policy to ensure customers can only update their own non-sensitive data
CREATE POLICY "Customers can update their own data" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());