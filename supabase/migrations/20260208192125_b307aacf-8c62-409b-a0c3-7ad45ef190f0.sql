
-- Deny anonymous access to customers table
CREATE POLICY "Deny anonymous access to customers"
ON public.customers
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to api_keys table
CREATE POLICY "Deny anonymous access to api_keys"
ON public.api_keys
FOR SELECT
TO anon
USING (false);
