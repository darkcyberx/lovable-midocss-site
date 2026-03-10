
-- =============================================
-- COMPREHENSIVE RLS POLICY FIX
-- Drop ALL existing policies and recreate as PERMISSIVE with TO authenticated
-- This cleanly denies anonymous access (no policies = no access with RLS enabled)
-- =============================================

-- ============ CUSTOMERS ============
DROP POLICY IF EXISTS "Deny anonymous access to customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;

CREATE POLICY "Admins can manage customers" ON public.customers
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers can view own data" ON public.customers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Customers can update own data" ON public.customers
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============ API_KEYS ============
DROP POLICY IF EXISTS "Deny anonymous access to api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can view own API keys via safe view" ON public.api_keys;
DROP POLICY IF EXISTS "Users manage own API keys" ON public.api_keys;

CREATE POLICY "Users manage own API keys" ON public.api_keys
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============ LICENSES ============
DROP POLICY IF EXISTS "Deny anonymous access to licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.licenses;
DROP POLICY IF EXISTS "Customers view own licenses" ON public.licenses;

CREATE POLICY "Admins can manage licenses" ON public.licenses
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own licenses" ON public.licenses
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = licenses.customer_id AND customers.user_id = auth.uid()
));

-- ============ LOGS ============
DROP POLICY IF EXISTS "Deny anonymous access to logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.logs;

CREATE POLICY "Admins can view logs" ON public.logs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert logs" ON public.logs
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ DEVICES ============
DROP POLICY IF EXISTS "Admins can manage devices" ON public.devices;
DROP POLICY IF EXISTS "Customers view own devices" ON public.devices;

CREATE POLICY "Admins can manage devices" ON public.devices
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own devices" ON public.devices
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM licenses
  JOIN customers ON customers.id = licenses.customer_id
  WHERE licenses.id = devices.license_id AND customers.user_id = auth.uid()
));

-- ============ INVOICES ============
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Customers view own invoices" ON public.invoices;

CREATE POLICY "Admins can manage invoices" ON public.invoices
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers view own invoices" ON public.invoices
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM customers
  WHERE customers.id = invoices.customer_id AND customers.user_id = auth.uid()
));

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Only authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- ============ NOTIFICATION_SETTINGS ============
DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;

CREATE POLICY "Admins can manage notification settings" ON public.notification_settings
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

CREATE POLICY "Authenticated users can view products" ON public.products
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage products" ON public.products
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
