-- Drop the broken trigger that references non-existent updated_at column
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;