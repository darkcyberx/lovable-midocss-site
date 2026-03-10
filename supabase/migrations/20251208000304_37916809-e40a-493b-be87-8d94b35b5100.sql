-- Fix 1: Ensure customers table is protected from anonymous access
-- Drop existing policies and recreate with proper security
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view their own data" ON public.customers;

-- Recreate with PERMISSIVE policies (default is RESTRICTIVE which requires ALL policies to pass)
CREATE POLICY "Admins can view customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view their own data" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Fix 2: Strengthen api_keys table security
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;

CREATE POLICY "Users can view their own API keys" 
ON public.api_keys 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" 
ON public.api_keys 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" 
ON public.api_keys 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" 
ON public.api_keys 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: Restrict log insertion to admins only (not any authenticated user)
DROP POLICY IF EXISTS "System can insert logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;

CREATE POLICY "Admins can view logs" 
ON public.logs 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert logs" 
ON public.logs 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add a column to store hashed API keys for future use (keeping original for backward compatibility)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_hash text;

-- Create function to hash API keys on insert/update
CREATE OR REPLACE FUNCTION public.hash_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key IS NOT NULL THEN
    NEW.key_hash := encode(sha256(NEW.key::bytea), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for hashing
DROP TRIGGER IF EXISTS hash_api_key_trigger ON public.api_keys;
CREATE TRIGGER hash_api_key_trigger
BEFORE INSERT OR UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.hash_api_key();