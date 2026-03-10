-- Drop the security definer view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.api_keys_safe;

-- Create a secure view with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.api_keys_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  name,
  key_hash,
  is_active,
  expires_at,
  created_at,
  last_used_at,
  -- Show only masked version of the key
  CONCAT(LEFT(key, 8), '...', RIGHT(key, 4)) as key_masked
FROM public.api_keys;

-- Grant access to the view
GRANT SELECT ON public.api_keys_safe TO authenticated;