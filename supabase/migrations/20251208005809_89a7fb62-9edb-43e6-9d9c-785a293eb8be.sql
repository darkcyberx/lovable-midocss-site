-- Fix: Change RLS policies to PERMISSIVE and add explicit anonymous denial
-- The issue is that RESTRICTIVE policies only work alongside PERMISSIVE ones

-- ===== CUSTOMERS TABLE =====
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view their own data only" ON public.customers;
DROP POLICY IF EXISTS "Customers can update their own data" ON public.customers;

CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own data" ON public.customers FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Customers can update own data" ON public.customers FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== API_KEYS TABLE =====
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;

CREATE POLICY "Users manage own API keys" ON public.api_keys FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ===== PROFILES TABLE =====
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- ===== LICENSES TABLE =====
DROP POLICY IF EXISTS "Admins can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can update licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admins can delete licenses" ON public.licenses;
DROP POLICY IF EXISTS "Customers can view their own licenses" ON public.licenses;

CREATE POLICY "Admins can manage licenses" ON public.licenses FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers view own licenses" ON public.licenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = licenses.customer_id AND customers.user_id = auth.uid()));

-- ===== INVOICES TABLE =====
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;

CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers view own invoices" ON public.invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = invoices.customer_id AND customers.user_id = auth.uid()));

-- ===== DEVICES TABLE =====
DROP POLICY IF EXISTS "Admins can view devices" ON public.devices;
DROP POLICY IF EXISTS "Admins can insert devices" ON public.devices;
DROP POLICY IF EXISTS "Admins can update devices" ON public.devices;
DROP POLICY IF EXISTS "Admins can delete devices" ON public.devices;
DROP POLICY IF EXISTS "Customers can view their own devices" ON public.devices;

CREATE POLICY "Admins can manage devices" ON public.devices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers view own devices" ON public.devices FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM licenses 
  JOIN customers ON customers.id = licenses.customer_id 
  WHERE licenses.id = devices.license_id AND customers.user_id = auth.uid()
));

-- ===== USER_ROLES TABLE =====
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ===== LOGS TABLE =====
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.logs;
DROP POLICY IF EXISTS "No one can update logs" ON public.logs;
DROP POLICY IF EXISTS "No one can delete logs" ON public.logs;

CREATE POLICY "Admins can view logs" ON public.logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert logs" ON public.logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== PRODUCTS TABLE =====
DROP POLICY IF EXISTS "Admins can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== NOTIFICATION_SETTINGS TABLE =====
DROP POLICY IF EXISTS "Admins can view notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Admins can insert notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Admins can update notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Admins can delete notification settings" ON public.notification_settings;

CREATE POLICY "Admins can manage notification settings" ON public.notification_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));