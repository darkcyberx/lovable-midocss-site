-- 1. Null out any existing plaintext keys that may remain
UPDATE public.api_keys SET key = NULL WHERE key IS NOT NULL;

-- 2. Add RLS on api_keys_safe view to restrict users to their own keys only
-- Views inherit RLS from underlying tables when security_invoker = true (already set)
-- api_keys already has: "Users manage own API keys" policy where auth.uid() = user_id
-- So api_keys_safe with security_invoker=true will automatically filter by user

-- 3. The hash_api_key trigger already nulls out the key (updated in previous migration)
-- Verify by checking trigger still works correctly - no action needed, already done