-- Create enum for license status
CREATE TYPE license_status AS ENUM ('active', 'expired', 'suspended', 'pending');

-- Create enum for log actions
CREATE TYPE log_action AS ENUM ('created', 'updated', 'deleted', 'activated', 'deactivated', 'verified');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create licenses table
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  status license_status DEFAULT 'pending',
  max_devices INTEGER DEFAULT 1,
  expire_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create devices table
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE,
  hwid TEXT NOT NULL,
  device_name TEXT,
  os_info TEXT,
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_id, hwid)
);

-- Create logs table
CREATE TABLE public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action log_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for customers (admin only)
CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete customers"
  ON public.customers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for products
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for licenses
CREATE POLICY "Authenticated users can view licenses"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert licenses"
  ON public.licenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update licenses"
  ON public.licenses FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete licenses"
  ON public.licenses FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for devices
CREATE POLICY "Authenticated users can view devices"
  ON public.devices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert devices"
  ON public.devices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update devices"
  ON public.devices FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete devices"
  ON public.devices FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for logs
CREATE POLICY "Authenticated users can view logs"
  ON public.logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON public.logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique license key
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    FOR j IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF i < 4 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
-- Drop existing trigger and function to recreate them properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create improved function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'admin'
  );
  RETURN new;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- Fix security warnings by adding search_path to all functions

-- Update update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Update generate_license_key function
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..4 LOOP
    FOR j IN 1..4 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF i < 4 THEN
      result := result || '-';
    END IF;
  END LOOP;
  RETURN result;
END;
$$;
-- Create API keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for api_keys
CREATE POLICY "Users can view their own API keys"
ON public.api_keys
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys"
ON public.api_keys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys"
ON public.api_keys
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys"
ON public.api_keys
FOR DELETE
USING (auth.uid() = user_id);

-- Create function to generate API key
CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'lm_';
  i INTEGER;
BEGIN
  FOR i IN 1..48 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
BEFORE UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing profiles roles to user_roles table


-- Drop old RLS policies on customers table
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;

-- Create new admin-only policies for customers
CREATE POLICY "Admins can view customers"
ON public.customers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete customers"
ON public.customers
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Drop old RLS policies on logs table
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON public.logs;
DROP POLICY IF EXISTS "Authenticated users can view logs" ON public.logs;

-- Create new admin-only policies for logs (read-only audit log)
CREATE POLICY "Admins can view logs"
ON public.logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert logs"
ON public.logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS policy for user_roles (users can view their own roles, admins can manage all)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Drop old RLS policies on products table
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;

-- Create new admin-only policies for products
CREATE POLICY "Admins can view products"
ON public.products
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
-- Fix RLS policies for licenses table
DROP POLICY IF EXISTS "Authenticated users can view licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated users can insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated users can update licenses" ON public.licenses;
DROP POLICY IF EXISTS "Authenticated users can delete licenses" ON public.licenses;

CREATE POLICY "Admins can view licenses"
ON public.licenses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert licenses"
ON public.licenses
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update licenses"
ON public.licenses
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete licenses"
ON public.licenses
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix RLS policies for devices table
DROP POLICY IF EXISTS "Authenticated users can view devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can insert devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can update devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated users can delete devices" ON public.devices;

CREATE POLICY "Admins can view devices"
ON public.devices
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert devices"
ON public.devices
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update devices"
ON public.devices
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete devices"
ON public.devices
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow validate-license edge function to insert devices via service role
-- (Edge function uses service role key, not affected by these policies)

-- Remove legacy role column from profiles table to avoid confusion
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_days integer[] NOT NULL DEFAULT ARRAY[7, 3, 1],
  notification_time time NOT NULL DEFAULT '09:00:00',
  email_subject text NOT NULL DEFAULT 'ØªÙ†Ø¨ÙŠÙ‡: Ø§Ù‚ØªØ±Ø§Ø¨ Ø§Ù†ØªÙ‡Ø§Ø¡ ØªØ±Ø®ÙŠØµÙƒ',
  email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view notification settings"
  ON public.notification_settings
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert notification settings"
  ON public.notification_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update notification settings"
  ON public.notification_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete notification settings"
  ON public.notification_settings
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings

-- Add customer role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'customer';

-- Add user_id to customers table to link with auth
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS account_created boolean DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  license_id uuid REFERENCES public.licenses(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text DEFAULT 'EGP',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded')),
  due_date timestamp with time zone,
  paid_at timestamp with time zone,
  payment_method text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_license_id ON public.invoices(license_id);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
-- Admins can manage all invoices
CREATE POLICY "Admins can view all invoices"
  ON public.invoices FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update invoices"
  ON public.invoices FOR UPDATE
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Customers can view their own invoices
CREATE POLICY "Customers can view their own invoices"
  ON public.invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = invoices.customer_id
      AND customers.user_id = auth.uid()
    )
  );

-- Update customers RLS to allow customers to view their own data
CREATE POLICY "Customers can view their own data"
  ON public.customers FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Update licenses RLS to allow customers to view their own licenses
CREATE POLICY "Customers can view their own licenses"
  ON public.licenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customers
      WHERE customers.id = licenses.customer_id
      AND customers.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  );

-- Update devices RLS to allow customers to view devices linked to their licenses
CREATE POLICY "Customers can view their own devices"
  ON public.devices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.licenses
      JOIN public.customers ON customers.id = licenses.customer_id
      WHERE licenses.id = devices.license_id
      AND customers.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  );

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_prefix text := TO_CHAR(NOW(), 'YYYY');
  next_number integer;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(invoice_number FROM 6)::integer), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoice_number LIKE year_prefix || '%';
  
  RETURN year_prefix || LPAD(next_number::text, 5, '0');
END;
$$;

-- Trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invoice_number_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_number();

-- Trigger for updated_at on invoices
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Fix 1: Ensure customers table is protected from anonymous access
-- Drop existing policies and recreate with proper security
DROP POLICY IF EXISTS "Admins can view customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view their own data" ON public.customers;

-- Recreate with PERMISSIVE policies (default is RESTRICTIVE which requires ALL policies to pass)
CREATE POLICY "Admins can view customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view their own data" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Fix 2: Strengthen api_keys table security
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;

CREATE POLICY "Users can view their own API keys" 
ON public.api_keys 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" 
ON public.api_keys 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" 
ON public.api_keys 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" 
ON public.api_keys 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: Restrict log insertion to admins only (not any authenticated user)
DROP POLICY IF EXISTS "System can insert logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;

CREATE POLICY "Admins can view logs" 
ON public.logs 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert logs" 
ON public.logs 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add a column to store hashed API keys for future use (keeping original for backward compatibility)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_hash text;

-- Create function to hash API keys on insert/update
CREATE OR REPLACE FUNCTION public.hash_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.key IS NOT NULL THEN
    NEW.key_hash := encode(sha256(NEW.key::bytea), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for hashing
DROP TRIGGER IF EXISTS hash_api_key_trigger ON public.api_keys;
CREATE TRIGGER hash_api_key_trigger
BEFORE INSERT OR UPDATE ON public.api_keys
FOR EACH ROW
EXECUTE FUNCTION public.hash_api_key();
-- Fix the handle_new_user function that's trying to insert into a non-existent "role" column
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Fix 1: Make logs table append-only (prevent UPDATE and DELETE)
-- Create explicit deny policies for UPDATE and DELETE
CREATE POLICY "No one can update logs" 
ON public.logs 
FOR UPDATE 
TO authenticated
USING (false);

CREATE POLICY "No one can delete logs" 
ON public.logs 
FOR DELETE 
TO authenticated
USING (false);

-- Fix 2: Add additional protection for customers table
-- Ensure that customers can only be accessed through proper channels
-- Update RLS to use more restrictive patterns

-- Drop and recreate customer policies with stronger protection
DROP POLICY IF EXISTS "Customers can view their own data" ON public.customers;

-- Customers can ONLY view their own data (not other customers by guessing IDs)
CREATE POLICY "Customers can view their own data only" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- Add policy to ensure customers can only update their own non-sensitive data
CREATE POLICY "Customers can update their own data" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
-- Update RLS policy to hide the key column from SELECT
-- First, we need to create a view that excludes the key column for normal access

-- Create a view that masks the key column
CREATE OR REPLACE VIEW public.api_keys_safe AS
SELECT 
  id,
  user_id,
  name,
  key_hash,
  is_active,
  expires_at,
  created_at,
  last_used_at,
  -- Show only masked version of the key
  CONCAT(LEFT(key, 8), '...', RIGHT(key, 4)) as key_masked
FROM public.api_keys;

-- Grant access to the view
GRANT SELECT ON public.api_keys_safe TO authenticated;

-- Enable RLS on the view (views inherit RLS from base table)

-- Create a function to validate API key by hash (for edge functions)
CREATE OR REPLACE FUNCTION public.validate_api_key_by_value(api_key_value text)
RETURNS TABLE(user_id uuid, is_active boolean, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, is_active, expires_at
  FROM public.api_keys
  WHERE key = api_key_value
  LIMIT 1;
$$;

-- Create a function to update last_used_at by key value (for edge functions)
CREATE OR REPLACE FUNCTION public.update_api_key_last_used(api_key_value text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE key = api_key_value;
$$;
-- Drop the security definer view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.api_keys_safe;

-- Create a secure view with SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.api_keys_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  name,
  key_hash,
  is_active,
  expires_at,
  created_at,
  last_used_at,
  -- Show only masked version of the key
  CONCAT(LEFT(key, 8), '...', RIGHT(key, 4)) as key_masked
FROM public.api_keys;

-- Grant access to the view
GRANT SELECT ON public.api_keys_safe TO authenticated;
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
-- Fix 1: Add RLS policy to api_keys_safe view
-- Note: Views inherit RLS from base tables, but we should ensure proper access
CREATE POLICY "Users can view own API keys via safe view"
ON public.api_keys
FOR SELECT
USING (auth.uid() = user_id);

-- Fix 2: Add read policy for products table so customers can see product names
CREATE POLICY "Authenticated users can view products"
ON public.products
FOR SELECT
TO authenticated
USING (true);
-- Fix: Add explicit policies to deny anonymous access

-- Profiles table - ensure only authenticated users can access
CREATE POLICY "Only authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Drop and recreate with proper restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Licenses table - add authenticated-only baseline
CREATE POLICY "Deny anonymous access to licenses"
ON public.licenses
FOR SELECT
TO anon
USING (false);

-- Logs table - add authenticated-only baseline  
CREATE POLICY "Deny anonymous access to logs"
ON public.logs
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to customers table
CREATE POLICY "Deny anonymous access to customers"
ON public.customers
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to api_keys table
CREATE POLICY "Deny anonymous access to api_keys"
ON public.api_keys
FOR SELECT
TO anon
USING (false);

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

-- Update validate_api_key_by_value to use key_hash instead of plaintext key
CREATE OR REPLACE FUNCTION public.validate_api_key_by_value(api_key_value text)
 RETURNS TABLE(user_id uuid, is_active boolean, expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT user_id, is_active, expires_at
  FROM public.api_keys
  WHERE key_hash = encode(sha256(api_key_value::bytea), 'hex')
  LIMIT 1;
$$;

-- Update update_api_key_last_used to use key_hash instead of plaintext key
CREATE OR REPLACE FUNCTION public.update_api_key_last_used(api_key_value text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  UPDATE public.api_keys
  SET last_used_at = now()
  WHERE key_hash = encode(sha256(api_key_value::bytea), 'hex');
$$;

-- Fix all RESTRICTIVE policies to PERMISSIVE TO authenticated

-- ===== CUSTOMERS =====
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;

CREATE POLICY "Admins can manage customers" ON public.customers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers can view own data" ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Customers can update own data" ON public.customers FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== INVOICES =====
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Customers view own invoices" ON public.invoices;

CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers view own invoices" ON public.invoices FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = invoices.customer_id AND customers.user_id = auth.uid()));

-- ===== LICENSES =====
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.licenses;
DROP POLICY IF EXISTS "Customers view own licenses" ON public.licenses;

CREATE POLICY "Admins can manage licenses" ON public.licenses FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers view own licenses" ON public.licenses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = licenses.customer_id AND customers.user_id = auth.uid()));

-- ===== DEVICES =====
DROP POLICY IF EXISTS "Admins can manage devices" ON public.devices;
DROP POLICY IF EXISTS "Customers view own devices" ON public.devices;

CREATE POLICY "Admins can manage devices" ON public.devices FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Customers view own devices" ON public.devices FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM licenses JOIN customers ON customers.id = licenses.customer_id WHERE licenses.id = devices.license_id AND customers.user_id = auth.uid()));

-- ===== API_KEYS =====
DROP POLICY IF EXISTS "Users manage own API keys" ON public.api_keys;

CREATE POLICY "Users manage own API keys" ON public.api_keys FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== LOGS =====
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON public.logs;

CREATE POLICY "Admins can view logs" ON public.logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert logs" ON public.logs FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===== USER_ROLES =====
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ===== NOTIFICATION_SETTINGS =====
DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;

CREATE POLICY "Admins can manage notification settings" ON public.notification_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===== PROFILES =====
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ===== PRODUCTS =====
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

CREATE POLICY "Authenticated users can view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
-- Drop the broken trigger that references non-existent updated_at column
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
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

-- Table for renewal tokens (magic links for license renewal)
CREATE TABLE public.renewal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_used boolean NOT NULL DEFAULT false,
  renewal_days integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.renewal_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins can create/manage renewal tokens
CREATE POLICY "Admins can manage renewal tokens"
ON public.renewal_tokens
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table to link Telegram chat IDs to customers
CREATE TABLE public.telegram_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage telegram links
CREATE POLICY "Admins can manage telegram links"
ON public.telegram_links
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create renewal_requests table for tracking customer renewal orders
CREATE TABLE public.renewal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  days INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  telegram_chat_id BIGINT,
  receipt_note TEXT,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage renewal requests"
ON public.renewal_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_renewal_requests_updated_at
BEFORE UPDATE ON public.renewal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create registration requests table for new customer signups via Telegram
CREATE TABLE public.registration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage registration requests"
  ON public.registration_requests
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_registration_requests_updated_at
  BEFORE UPDATE ON public.registration_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.telegram_user_states (
  telegram_chat_id bigint PRIMARY KEY,
  step text NOT NULL,
  data jsonb DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_user_states ENABLE ROW LEVEL SECURITY;
-- Only accessible via service role (edge functions), no user-facing RLS needed
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS telegram_message_template text DEFAULT 
'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
{urgencyEmoji} *ØªÙ†Ø¨ÙŠÙ‡ Ø§Ù†ØªÙ‡Ø§Ø¡ ØªØ±Ø®ÙŠØµ*
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Ù…Ø±Ø­Ø¨Ø§Ù‹ *{customerName}*

ØªØ±Ø®ÙŠØµÙƒ Ù„Ù…Ù†ØªØ¬ *{productName}* Ø³ÙŠÙ†ØªÙ‡ÙŠ Ù‚Ø±ÙŠØ¨Ø§Ù‹!

ðŸ”‘ Ø§Ù„Ù…ÙØªØ§Ø­: `{licenseKey}`
ðŸ“… ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡: {expiryDate}
â° Ø§Ù„Ø£ÙŠØ§Ù… Ø§Ù„Ù…ØªØ¨Ù‚ÙŠØ©: *{daysRemaining} ÙŠÙˆÙ…*

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
ðŸ”„ Ù„ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„ØªØ±Ø®ÙŠØµ Ø£Ø±Ø³Ù„:
/renew {licenseKey}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”';
CREATE POLICY "Admins can delete logs" ON public.logs FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
-- Add payment fields to registration_requests table
ALTER TABLE public.registration_requests
  ADD COLUMN IF NOT EXISTS requested_days integer,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS receipt_note text;
-- Create blocked_ips table
CREATE TABLE public.blocked_ips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL UNIQUE,
  reason text,
  blocked_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked IPs
CREATE POLICY "Admins can manage blocked IPs"
  ON public.blocked_ips
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add index for fast lookups
CREATE INDEX idx_blocked_ips_ip ON public.blocked_ips(ip_address);

-- Add ip_address column to logs if missing (for tracking request IPs)
ALTER TABLE public.logs ALTER COLUMN ip_address TYPE text;
DROP TABLE IF EXISTS public.renewal_tokens CASCADE;

CREATE TABLE public.rustdesk_ids (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  rustdesk_id text NOT NULL,
  device_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rustdesk_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rustdesk_ids"
  ON public.rustdesk_ids
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX rustdesk_ids_customer_id_idx ON public.rustdesk_ids (customer_id);

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
-- Fix: Enable RLS and add policies for telegram_user_states
-- This table had RLS enabled but NO policies, meaning it was accessible to no one
-- (which causes the linter warning). The bot uses service_role to write to it,
-- so we only need to ensure authenticated users (admins) can manage it.

ALTER TABLE public.telegram_user_states ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service_role) to bypass RLS automatically.
-- For the admin panel, only admins need to view telegram states.
CREATE POLICY "Admins can manage telegram user states"
ON public.telegram_user_states
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX 1: Convert all RESTRICTIVE policies to PERMISSIVE
-- (RESTRICTIVE-only means NO ONE can access data through anon key)
-- ============================================================

-- ---- customers ----
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Admins can manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;
CREATE POLICY "Customers can view own data" ON public.customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;
CREATE POLICY "Customers can update own data" ON public.customers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---- licenses ----
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.licenses;
CREATE POLICY "Admins can manage licenses" ON public.licenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own licenses" ON public.licenses;
CREATE POLICY "Customers view own licenses" ON public.licenses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = licenses.customer_id
      AND customers.user_id = auth.uid()
  ));

-- ---- devices ----
DROP POLICY IF EXISTS "Admins can manage devices" ON public.devices;
CREATE POLICY "Admins can manage devices" ON public.devices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own devices" ON public.devices;
CREATE POLICY "Customers view own devices" ON public.devices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.licenses
    JOIN public.customers ON customers.id = licenses.customer_id
    WHERE licenses.id = devices.license_id
      AND customers.user_id = auth.uid()
  ));

-- ---- invoices ----
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own invoices" ON public.invoices;
CREATE POLICY "Customers view own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = invoices.customer_id
      AND customers.user_id = auth.uid()
  ));

-- ---- products ----
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT TO authenticated
  USING (true);

-- ---- logs ----
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
CREATE POLICY "Admins can view logs" ON public.logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert logs" ON public.logs;
CREATE POLICY "Admins can insert logs" ON public.logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete logs" ON public.logs;
CREATE POLICY "Admins can delete logs" ON public.logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- profiles ----
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ---- user_roles ----
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---- api_keys ----
DROP POLICY IF EXISTS "Users manage own API keys" ON public.api_keys;
CREATE POLICY "Users manage own API keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- renewal_requests ----
DROP POLICY IF EXISTS "Admins can manage renewal requests" ON public.renewal_requests;
CREATE POLICY "Admins can manage renewal requests" ON public.renewal_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- registration_requests ----
DROP POLICY IF EXISTS "Admins can manage registration requests" ON public.registration_requests;
CREATE POLICY "Admins can manage registration requests" ON public.registration_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- rustdesk_ids ----
DROP POLICY IF EXISTS "Admins can manage rustdesk_ids" ON public.rustdesk_ids;
CREATE POLICY "Admins can manage rustdesk_ids" ON public.rustdesk_ids
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- blocked_ips ----
DROP POLICY IF EXISTS "Admins can manage blocked IPs" ON public.blocked_ips;
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- notification_settings ----
DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;
CREATE POLICY "Admins can manage notification settings" ON public.notification_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- telegram_links ----
DROP POLICY IF EXISTS "Admins can manage telegram links" ON public.telegram_links;
CREATE POLICY "Admins can manage telegram links" ON public.telegram_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ---- telegram_user_states ----
DROP POLICY IF EXISTS "Admins can manage telegram user states" ON public.telegram_user_states;
CREATE POLICY "Admins can manage telegram user states" ON public.telegram_user_states
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- FIX 2: Make api_keys_safe view use security_invoker
-- so it inherits RLS from the underlying api_keys table
-- ============================================================
ALTER VIEW public.api_keys_safe SET (security_invoker = true);

-- Ø§Ù„Ø®Ø·ÙˆØ© 1: Ø¬Ø¹Ù„ Ø¹Ù…ÙˆØ¯ key ÙŠÙ‚Ø¨Ù„ NULL Ø£ÙˆÙ„Ø§Ù‹
ALTER TABLE public.api_keys ALTER COLUMN key DROP NOT NULL;

-- Ø§Ù„Ø®Ø·ÙˆØ© 2: Ø­Ø°Ù Ù‚ÙŠÙ… Ø§Ù„Ù†Øµ Ø§Ù„Ø¹Ø§Ø¯ÙŠ (Ø§Ù„Ù‡Ø§Ø´ Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ù„ÙØ¹Ù„ ÙÙŠ key_hash)
UPDATE public.api_keys SET key = NULL WHERE key IS NOT NULL;
-- Add key_prefix column for safe display (first 8 chars)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;

-- Populate key_prefix from existing keys before nulling them
UPDATE public.api_keys SET key_prefix = LEFT(key, 8) WHERE key IS NOT NULL;

-- Null out all plaintext keys
UPDATE public.api_keys SET key = NULL WHERE key IS NOT NULL;

-- Update the hash_api_key trigger to store prefix and then null out the key
CREATE OR REPLACE FUNCTION public.hash_api_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.key IS NOT NULL THEN
    NEW.key_prefix := LEFT(NEW.key, 8);
    NEW.key_hash   := encode(sha256(NEW.key::bytea), 'hex');
    NEW.key        := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate the view with correct column order to match existing schema
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe AS
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
-- 1. Null out any existing plaintext keys that may remain
UPDATE public.api_keys SET key = NULL WHERE key IS NOT NULL;

-- 2. Add RLS on api_keys_safe view to restrict users to their own keys only
-- Views inherit RLS from underlying tables when security_invoker = true (already set)
-- api_keys already has: "Users manage own API keys" policy where auth.uid() = user_id
-- So api_keys_safe with security_invoker=true will automatically filter by user

-- 3. The hash_api_key trigger already nulls out the key (updated in previous migration)
-- Verify by checking trigger still works correctly - no action needed, already done
-- 1. Add customer SELECT policy for renewal_requests
CREATE POLICY "Customers view own renewal requests"
ON public.renewal_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = renewal_requests.customer_id
      AND customers.user_id = auth.uid()
  )
);

-- 2. Add customer SELECT policy for rustdesk_ids
CREATE POLICY "Customers view own rustdesk ids"
ON public.rustdesk_ids
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = rustdesk_ids.customer_id
      AND customers.user_id = auth.uid()
  )
);
-- Recreate api_keys_safe view with security_invoker=true so RLS on api_keys is enforced
DROP VIEW IF EXISTS public.api_keys_safe;
CREATE VIEW public.api_keys_safe
WITH (security_invoker = true)
AS
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
-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- Move pg_net to extensions schema to fix security warning
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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

-- ============================================================
-- 1. ATTACH hash_api_key TRIGGER (function exists, trigger missing)
-- ============================================================
DROP TRIGGER IF EXISTS hash_api_key_trigger ON public.api_keys;
CREATE TRIGGER hash_api_key_trigger
  BEFORE INSERT OR UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.hash_api_key();

-- ============================================================
-- 2. CLEAN UP existing plaintext keys + backfill key_prefix
-- ============================================================
UPDATE public.api_keys
SET
  key_prefix = COALESCE(key_prefix, LEFT(key, 8)),
  key_hash   = COALESCE(key_hash, encode(sha256(key::bytea), 'hex')),
  key        = NULL
WHERE key IS NOT NULL;

-- ============================================================
-- 3. FIX ALL RLS POLICIES: RESTRICTIVE â†’ PERMISSIVE
-- ============================================================

-- customers
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
CREATE POLICY "Admins can manage customers" ON public.customers AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers can view own data" ON public.customers;
CREATE POLICY "Customers can view own data" ON public.customers AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own data" ON public.customers;
CREATE POLICY "Customers can update own data" ON public.customers AS PERMISSIVE FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- licenses
DROP POLICY IF EXISTS "Admins can manage licenses" ON public.licenses;
CREATE POLICY "Admins can manage licenses" ON public.licenses AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own licenses" ON public.licenses;
CREATE POLICY "Customers view own licenses" ON public.licenses AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = licenses.customer_id AND customers.user_id = auth.uid()));

-- devices
DROP POLICY IF EXISTS "Admins can manage devices" ON public.devices;
CREATE POLICY "Admins can manage devices" ON public.devices AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own devices" ON public.devices;
CREATE POLICY "Customers view own devices" ON public.devices AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM licenses JOIN customers ON customers.id = licenses.customer_id WHERE licenses.id = devices.license_id AND customers.user_id = auth.uid()));

-- invoices
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices" ON public.invoices AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own invoices" ON public.invoices;
CREATE POLICY "Customers view own invoices" ON public.invoices AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = invoices.customer_id AND customers.user_id = auth.uid()));

-- products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
CREATE POLICY "Authenticated users can view products" ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (true);

-- renewal_requests
DROP POLICY IF EXISTS "Admins can manage renewal requests" ON public.renewal_requests;
CREATE POLICY "Admins can manage renewal requests" ON public.renewal_requests AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own renewal requests" ON public.renewal_requests;
CREATE POLICY "Customers view own renewal requests" ON public.renewal_requests AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = renewal_requests.customer_id AND customers.user_id = auth.uid()));

-- registration_requests
DROP POLICY IF EXISTS "Admins can manage registration requests" ON public.registration_requests;
CREATE POLICY "Admins can manage registration requests" ON public.registration_requests AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- rustdesk_ids
DROP POLICY IF EXISTS "Admins can manage rustdesk_ids" ON public.rustdesk_ids;
CREATE POLICY "Admins can manage rustdesk_ids" ON public.rustdesk_ids AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Customers view own rustdesk ids" ON public.rustdesk_ids;
CREATE POLICY "Customers view own rustdesk ids" ON public.rustdesk_ids AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = rustdesk_ids.customer_id AND customers.user_id = auth.uid()));

-- blocked_ips
DROP POLICY IF EXISTS "Admins can manage blocked IPs" ON public.blocked_ips;
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- notification_settings
DROP POLICY IF EXISTS "Admins can manage notification settings" ON public.notification_settings;
CREATE POLICY "Admins can manage notification settings" ON public.notification_settings AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- logs
DROP POLICY IF EXISTS "Admins can view logs" ON public.logs;
CREATE POLICY "Admins can view logs" ON public.logs AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert logs" ON public.logs;
CREATE POLICY "Admins can insert logs" ON public.logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete logs" ON public.logs;
CREATE POLICY "Admins can delete logs" ON public.logs AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- telegram_links
DROP POLICY IF EXISTS "Admins can manage telegram links" ON public.telegram_links;
CREATE POLICY "Admins can manage telegram links" ON public.telegram_links AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- telegram_user_states
DROP POLICY IF EXISTS "Admins can manage telegram user states" ON public.telegram_user_states;
CREATE POLICY "Admins can manage telegram user states" ON public.telegram_user_states AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (user_id = auth.uid());

-- api_keys
DROP POLICY IF EXISTS "Users manage own API keys" ON public.api_keys;
CREATE POLICY "Users manage own API keys" ON public.api_keys AS PERMISSIVE FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
ALTER TABLE public.telegram_links
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamp with time zone;

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

CREATE TABLE public.revoked_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  reason text,
  revoked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.revoked_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage revoked keys"
  ON public.revoked_keys
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TABLE public.blocked_hwids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hwid text NOT NULL UNIQUE,
  reason text,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_hwids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage blocked hwids"
  ON public.blocked_hwids
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_blocked_hwids_hwid ON public.blocked_hwids(hwid);
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS kill_old_endpoint boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings 
ADD COLUMN IF NOT EXISTS kill_switch_response TEXT DEFAULT '{"valid":false,"error":"License not found","force_shutdown":true}';

-- Drop and recreate to change return type
DROP FUNCTION IF EXISTS public.validate_api_key_by_value(text);

CREATE FUNCTION public.validate_api_key_by_value(api_key_value text)
RETURNS TABLE(user_id uuid, is_active boolean, expires_at timestamp with time zone, key_prefix text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id, is_active, expires_at, key_prefix
  FROM public.api_keys
  WHERE key_hash = encode(sha256(api_key_value::bytea), 'hex')
  LIMIT 1;
$$;
CREATE TABLE IF NOT EXISTS public.project_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage project config"
  ON public.project_config
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_project_config_updated_at
  BEFORE UPDATE ON public.project_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

