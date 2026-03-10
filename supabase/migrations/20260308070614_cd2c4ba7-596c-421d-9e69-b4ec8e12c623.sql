
-- Drop old unique constraint on customer_id (one device per customer)
ALTER TABLE public.rustdesk_ids DROP CONSTRAINT IF EXISTS rustdesk_ids_customer_id_key;

-- Add unique constraint on rustdesk_id only (same ID can't be registered twice globally)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rustdesk_ids_rustdesk_id_key' AND conrelid = 'public.rustdesk_ids'::regclass
  ) THEN
    ALTER TABLE public.rustdesk_ids ADD CONSTRAINT rustdesk_ids_rustdesk_id_key UNIQUE (rustdesk_id);
  END IF;
END $$;
