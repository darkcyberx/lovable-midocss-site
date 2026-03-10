-- Fix security definer view: recreate as invoker security (default)
-- This ensures RLS policies of the querying user apply, not the view creator
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe WITH (security_invoker = true) AS
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