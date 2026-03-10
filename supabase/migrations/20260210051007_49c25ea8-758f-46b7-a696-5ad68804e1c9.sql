-- Create function to auto-expire licenses
CREATE OR REPLACE FUNCTION public.auto_expire_licenses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.licenses
  SET status = 'expired'
  WHERE status = 'active'
    AND expire_at IS NOT NULL
    AND expire_at < now();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;