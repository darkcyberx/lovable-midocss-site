-- Update RLS policy to hide the key column from SELECT
-- First, we need to create a view that excludes the key column for normal access

-- Create a view that masks the key column
CREATE OR REPLACE VIEW public.api_keys_safe AS
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

-- Enable RLS on the view (views inherit RLS from base table)

-- Create a function to validate API key by hash (for edge functions)
CREATE OR REPLACE FUNCTION public.validate_api_key_by_value(api_key_value text)
RETURNS TABLE(user_id uuid, is_active boolean, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, is_active, expires_at
  FROM public.api_keys
  WHERE key = api_key_value
  LIMIT 1;
$$;

-- Create a function to update last_used_at by key value (for edge functions)
CREATE OR REPLACE FUNCTION public.update_api_key_last_used(api_key_value text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE key = api_key_value;
$$;