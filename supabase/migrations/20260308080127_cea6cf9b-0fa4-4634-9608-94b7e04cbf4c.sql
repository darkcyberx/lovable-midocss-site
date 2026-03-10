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