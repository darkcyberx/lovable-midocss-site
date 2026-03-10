-- Fix 1: Add RLS policy to api_keys_safe view
-- Note: Views inherit RLS from base tables, but we should ensure proper access
CREATE POLICY "Users can view own API keys via safe view"
ON public.api_keys
FOR SELECT
USING (auth.uid() = user_id);

-- Fix 2: Add read policy for products table so customers can see product names
CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
TO authenticated
USING (true);