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