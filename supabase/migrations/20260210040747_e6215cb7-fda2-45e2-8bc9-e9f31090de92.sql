
-- Update validate_api_key_by_value to use key_hash instead of plaintext key
CREATE OR REPLACE FUNCTION public.validate_api_key_by_value(api_key_value text)
 RETURNS TABLE(user_id uuid, is_active boolean, expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT user_id, is_active, expires_at
  FROM public.api_keys
  WHERE key_hash = encode(sha256(api_key_value::bytea), 'hex')
  LIMIT 1;
$$;

-- Update update_api_key_last_used to use key_hash instead of plaintext key
CREATE OR REPLACE FUNCTION public.update_api_key_last_used(api_key_value text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE key_hash = encode(sha256(api_key_value::bytea), 'hex');
$$;
