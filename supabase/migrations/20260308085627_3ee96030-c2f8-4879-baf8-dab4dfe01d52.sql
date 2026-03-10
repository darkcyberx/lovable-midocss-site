-- Index on licenses.license_key (used heavily in validate-license lookups)
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON public.licenses(license_key);

-- Index on licenses.customer_id (used in JOIN queries)
CREATE INDEX IF NOT EXISTS idx_licenses_customer_id ON public.licenses(customer_id);

-- Index on licenses.status + expire_at (used in expiry checks)
CREATE INDEX IF NOT EXISTS idx_licenses_status_expire ON public.licenses(status, expire_at);

-- Index on devices.hwid (used in device lookup during validation)
CREATE INDEX IF NOT EXISTS idx_devices_hwid ON public.devices(hwid);

-- Index on devices.license_id (used in JOIN with licenses)
CREATE INDEX IF NOT EXISTS idx_devices_license_id ON public.devices(license_id);

-- Index on devices.is_active (used in filtering active devices)
CREATE INDEX IF NOT EXISTS idx_devices_is_active ON public.devices(is_active);

-- Index on customers.user_id (used in RLS policy checks)
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- Index on logs.entity_id + entity_type (used in activity log queries)
CREATE INDEX IF NOT EXISTS idx_logs_entity ON public.logs(entity_id, entity_type);

-- Index on logs.created_at (used in ordering/filtering logs)
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);

-- Index on renewal_requests.customer_id
CREATE INDEX IF NOT EXISTS idx_renewal_requests_customer_id ON public.renewal_requests(customer_id);

-- Index on telegram_links.telegram_chat_id (used in every bot interaction)
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON public.telegram_links(telegram_chat_id);