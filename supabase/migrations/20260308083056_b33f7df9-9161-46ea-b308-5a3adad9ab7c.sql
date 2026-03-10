-- Add key_prefix column for safe display (first 8 chars)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;

-- Populate key_prefix from existing keys before nulling them
UPDATE public.api_keys SET key_prefix = LEFT(key, 8) WHERE key IS NOT NULL;

-- Null out all plaintext keys
UPDATE public.api_keys SET key = NULL WHERE key IS NOT NULL;

-- Update the hash_api_key trigger to store prefix and then null out the key
CREATE OR REPLACE FUNCTION public.hash_api_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.key IS NOT NULL THEN
    NEW.key_prefix := LEFT(NEW.key, 8);
    NEW.key_hash   := encode(sha256(NEW.key::bytea), 'hex');
    NEW.key        := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate the view with correct column order to match existing schema
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe AS
SELECT
  id,
  user_id,
  name,
  is_active,
  key_hash,
  CASE
    WHEN key_prefix IS NOT NULL THEN key_prefix || '...'
    ELSE NULL
  END AS key_masked,
  expires_at,
  created_at,
  last_used_at
FROM public.api_keys;