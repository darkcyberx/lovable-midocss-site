
-- Drop and recreate to change return type
DROP FUNCTION IF EXISTS public.validate_api_key_by_value(text);

CREATE FUNCTION public.validate_api_key_by_value(api_key_value text)
RETURNS TABLE(user_id uuid, is_active boolean, expires_at timestamp with time zone, key_prefix text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id, is_active, expires_at, key_prefix
  FROM public.api_keys
  WHERE key_hash = encode(sha256(api_key_value::bytea), 'hex')
  LIMIT 1;
$$;
