
-- =============================================
-- FIX 1: Convert all RESTRICTIVE policies to PERMISSIVE
-- =============================================

-- renewal_requests
DROP POLICY IF EXISTS "Admins can manage renewal requests" ON public.renewal_requests;
DROP POLICY IF EXISTS "Customers view own renewal requests" ON public.renewal_requests;

CREATE POLICY "Admins can manage renewal requests" ON public.renewal_requests
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own renewal requests" ON public.renewal_requests
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = renewal_requests.customer_id
    AND customers.user_id = auth.uid()
));

-- devices
DROP POLICY IF EXISTS "Admins can manage devices" ON public.devices;
DROP POLICY IF EXISTS "Customers view own devices" ON public.devices;

CREATE POLICY "Admins can manage devices" ON public.devices
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own devices" ON public.devices
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM licenses
  JOIN customers ON customers.id = licenses.customer_id
  WHERE licenses.id = devices.license_id
    AND customers.user_id = auth.uid()
));

-- invoices
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Customers view own invoices" ON public.invoices;

CREATE POLICY "Admins can manage invoices" ON public.invoices
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own invoices" ON public.invoices
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = invoices.customer_id
    AND customers.user_id = auth.uid()
));

-- rustdesk_ids
DROP POLICY IF EXISTS "Admins can manage rustdesk_ids" ON public.rustdesk_ids;
DROP POLICY IF EXISTS "Customers view own rustdesk ids" ON public.rustdesk_ids;

CREATE POLICY "Admins can manage rustdesk_ids" ON public.rustdesk_ids
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own rustdesk ids" ON public.rustdesk_ids
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = rustdesk_ids.customer_id
    AND customers.user_id = auth.uid()
));

-- registration_requests
DROP POLICY IF EXISTS "Admins can manage registration requests" ON public.registration_requests;

CREATE POLICY "Admins can manage registration requests" ON public.registration_requests
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- licenses
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.licenses;
DROP POLICY IF EXISTS "Customers view own licenses" ON public.licenses;

CREATE POLICY "Admins can manage licenses" ON public.licenses
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own licenses" ON public.licenses
AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = licenses.customer_id
    AND customers.user_id = auth.uid()
));

-- api_keys
DROP POLICY IF EXISTS "Users manage own API keys" ON public.api_keys;

CREATE POLICY "Users manage own API keys" ON public.api_keys
AS PERMISSIVE FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;

CREATE POLICY "Admins can manage customers" ON public.customers
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can update own data" ON public.customers
AS PERMISSIVE FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Customers can view own data" ON public.customers
AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- telegram_links
DROP POLICY IF EXISTS "Admins can manage telegram links" ON public.telegram_links;

CREATE POLICY "Admins can manage telegram links" ON public.telegram_links
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own roles" ON public.user_roles
AS PERMISSIVE FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- blocked_ips
DROP POLICY IF EXISTS "Admins can manage blocked IPs" ON public.blocked_ips;

CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- notification_settings
DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;

CREATE POLICY "Admins can manage notification settings" ON public.notification_settings
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;

CREATE POLICY "Admins can manage products" ON public.products
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view products" ON public.products
AS PERMISSIVE FOR SELECT TO authenticated
USING (true);

-- telegram_user_states
DROP POLICY IF EXISTS "Admins can manage telegram user states" ON public.telegram_user_states;

CREATE POLICY "Admins can manage telegram user states" ON public.telegram_user_states
AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
AS PERMISSIVE FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON public.profiles
AS PERMISSIVE FOR SELECT TO authenticated
USING (auth.uid() = id);

-- logs
DROP POLICY IF EXISTS "Admins can delete logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;

CREATE POLICY "Admins can delete logs" ON public.logs
AS PERMISSIVE FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert logs" ON public.logs
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view logs" ON public.logs
AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FIX 2: API Keys trigger to clear plaintext after hashing
-- =============================================

DROP TRIGGER IF EXISTS hash_api_key_trigger ON public.api_keys;

CREATE TRIGGER hash_api_key_trigger
  BEFORE INSERT OR UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_api_key();

-- Clean up any existing plaintext keys
UPDATE public.api_keys
SET key = NULL
WHERE key IS NOT NULL;
