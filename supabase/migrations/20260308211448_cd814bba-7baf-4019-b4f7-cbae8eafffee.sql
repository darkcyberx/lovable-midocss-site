
-- Fix existing records: derive key_prefix from key_hash (first 8 chars of hash as identifier)
-- Since original key is NULL (already hashed), we use the hash prefix as identifier
UPDATE public.api_keys
SET key_prefix = LEFT(key_hash, 8)
WHERE key_prefix IS NULL AND key_hash IS NOT NULL;

-- Update hash_api_key function to also handle the case where key is already NULL gracefully
CREATE OR REPLACE FUNCTION public.hash_api_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.key IS NOT NULL THEN
    NEW.key_prefix := LEFT(NEW.key, 8);
    NEW.key_hash   := encode(sha256(NEW.key::bytea), 'hex');
    NEW.key        := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
